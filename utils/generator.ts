
import { PatrolLog, SiteConfig, DayConfig } from '../types';

const getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const toMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const fromMinutes = (totalMinutes: number): string => {
  let normalized = totalMinutes % (24 * 60);
  if (normalized < 0) normalized += 24 * 60;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
};

const getAbsoluteMinutes = (dateStr: string, timeStr: string): number => {
  const [y, month, day] = dateStr.split('-').map(Number);
  const [h, m] = timeStr.split(':').map(Number);
  return Date.UTC(y, month - 1, day, h, m) / (1000 * 60);
};

export const generateMissingData = (
  existingLogs: PatrolLog[],
  config: SiteConfig
): PatrolLog[] => {
  const { 
    month, year, tagsPerSite, 
    nightStart, nightEnd, dayStart, dayEnd,
    tagIntervalMin, tagIntervalMax
  } = config;

  let finalLogs: PatrolLog[] = [...existingLogs.map(l => ({ ...l, isGenerated: false }))];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Determina i tag da usare (usa quelli del file se presenti, altrimenti quelli config)
  const uniqueTagsInFile = Array.from(new Set(existingLogs.map(l => l.tag)));
  const baseTagNames = uniqueTagsInFile.length > 0 ? uniqueTagsInFile : config.tagNames;
  const targetTags = baseTagNames.slice(0, tagsPerSite);

  const MIN_ROUND_GAP = 90; // Almeno 1.5 ore tra un giro e l'altro

  for (let d = 1; d <= daysInMonth; d++) {
    const currentDate = new Date(year, month, d);
    const dayOfWeek = currentDate.getDay(); // 0 = Sun, 6 = Sat
    const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    // LOGICA DI SELEZIONE CONFIG:
    // Se è weekend e il numero di giri è > 0, consideriamo che l'utente voglia usare la config weekend.
    // Altrimenti usiamo la config standard (Sempre attiva).
    let currentDayConfig: DayConfig;
    const isWeekend = (dayOfWeek === 6 || dayOfWeek === 0);
    
    if (dayOfWeek === 6 && config.saturdayConfig.rounds > 0) {
      currentDayConfig = config.saturdayConfig;
    } else if (dayOfWeek === 0 && config.sundayConfig.rounds > 0) {
      currentDayConfig = config.sundayConfig;
    } else {
      currentDayConfig = {
        nightEnabled: config.nightShiftEnabled,
        dayEnabled: config.dayShiftEnabled,
        rounds: config.roundsPerShift
      };
    }

    const shiftsToProcess = [];
    if (currentDayConfig.nightEnabled) shiftsToProcess.push({ start: nightStart, end: nightEnd, type: 'NIGHT' });
    if (currentDayConfig.dayEnabled) shiftsToProcess.push({ start: dayStart, end: dayEnd, type: 'DAY' });

    shiftsToProcess.forEach(shift => {
      const shiftStartAbs = getAbsoluteMinutes(currentDateStr, shift.start);
      let shiftEndAbs = getAbsoluteMinutes(currentDateStr, shift.end);
      if (toMinutes(shift.end) <= toMinutes(shift.start)) {
        shiftEndAbs += (24 * 60); // Scavalca la mezzanotte
      }

      const shiftDuration = shiftEndAbs - shiftStartAbs;

      // 1. Trova log reali in questo turno
      const logsInShift = finalLogs.filter(l => {
        const logAbs = getAbsoluteMinutes(l.date, l.time);
        return logAbs >= (shiftStartAbs - 45) && logAbs <= (shiftEndAbs + 15) && !l.isGenerated;
      }).sort((a, b) => getAbsoluteMinutes(a.date, a.time) - getAbsoluteMinutes(b.date, b.time));

      // 2. Raggruppa in giri (un giro è un set di tag vicini nel tempo)
      const roundsFound: PatrolLog[][] = [];
      if (logsInShift.length > 0) {
        let currentGroup: PatrolLog[] = [logsInShift[0]];
        for (let i = 1; i < logsInShift.length; i++) {
          const diff = getAbsoluteMinutes(logsInShift[i].date, logsInShift[i].time) - 
                       getAbsoluteMinutes(logsInShift[i-1].date, logsInShift[i-1].time);
          if (diff > 45) { 
            roundsFound.push(currentGroup);
            currentGroup = [];
          }
          currentGroup.push(logsInShift[i]);
        }
        roundsFound.push(currentGroup);
      }

      // 3. Generazione giri mancanti con distribuzione intelligente
      const missingRoundsNeeded = Math.max(0, currentDayConfig.rounds - roundsFound.length);
      
      if (missingRoundsNeeded > 0) {
        const slotDuration = shiftDuration / currentDayConfig.rounds;
        
        for (let r = 0; r < currentDayConfig.rounds; r++) {
          const slotStart = shiftStartAbs + (r * slotDuration);
          const slotEnd = slotStart + slotDuration;
          
          // Verifica se c'è già un giro reale che "copre" questo slot temporale
          const hasRealRoundInSlot = roundsFound.some(round => {
             const avgTime = getAbsoluteMinutes(round[0].date, round[0].time);
             return avgTime >= slotStart - 30 && avgTime < slotEnd + 30;
          });

          if (hasRealRoundInSlot) continue;

          // Genera orario per il giro mancante
          let roundStartAbs = slotStart + getRandomInt(10, Math.floor(slotDuration * 0.5));
          
          // Evita sovrapposizioni troppo strette
          let attempts = 0;
          while (attempts < 5) {
            const tooClose = finalLogs.some(l => Math.abs(getAbsoluteMinutes(l.date, l.time) - roundStartAbs) < MIN_ROUND_GAP);
            if (!tooClose) break;
            roundStartAbs += 30;
            attempts++;
          }

          if (roundStartAbs > shiftEndAbs - 15) continue;

          let tagCursor = roundStartAbs;
          targetTags.forEach(tagName => {
            const tagDate = new Date(tagCursor * 60 * 1000);
            finalLogs.push({
              date: tagDate.toISOString().split('T')[0],
              time: fromMinutes(toMinutes(tagDate.toISOString().split('T')[1].substring(0, 5))),
              tag: tagName,
              isGenerated: true
            });
            tagCursor += getRandomInt(tagIntervalMin, tagIntervalMax);
          });
        }
      }
    });
  }

  // Deduplicazione finale basata su Data, Ora (HH:mm) e Tag
  const uniqueMap = new Map<string, PatrolLog>();
  finalLogs.forEach(l => {
    const key = `${l.date}_${l.time.substring(0, 5)}_${l.tag}`;
    if (!uniqueMap.has(key) || !l.isGenerated) {
      uniqueMap.set(key, l);
    }
  });

  return Array.from(uniqueMap.values()).sort((a, b) => {
    return getAbsoluteMinutes(a.date, a.time) - getAbsoluteMinutes(b.date, b.time);
  });
};

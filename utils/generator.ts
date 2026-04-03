
import { PatrolLog, SiteConfig, DayConfig } from '../types';

const getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const toMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// Helper per gestire i minuti assoluti in modo coerente (Locale)
const getAbsoluteMinutes = (dateStr: string, timeStr: string): number => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).getTime() / (1000 * 60);
};

// Helper per convertire minuti assoluti in data/ora locali
const fromAbsoluteMinutes = (absMinutes: number): { date: string, time: string } => {
  const d = new Date(absMinutes * 60 * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${mins}:00`
  };
};

const normalizeTag = (t: string) => t.trim().toUpperCase().replace(/\s+/g, ' ').replace(/:/g, '');

export const generateMissingData = (
  existingLogs: PatrolLog[],
  config: SiteConfig
): PatrolLog[] => {
  const { 
    month, year, tagsPerSite, 
    nightStart, nightEnd, dayStart, dayEnd,
    tagIntervalMin, tagIntervalMax
  } = config;

  // 1. Mappa dei tag per preservare il formato originale
  const tagMap = new Map<string, string>();
  config.tagNames.forEach(t => {
    const norm = normalizeTag(t);
    if (!tagMap.has(norm)) tagMap.set(norm, t.trim());
  });
  existingLogs.forEach(l => {
    const norm = normalizeTag(l.tag);
    if (!tagMap.has(norm)) tagMap.set(norm, l.tag.trim());
  });

  // 2. Normalizzazione log esistenti
  const initialLogs: PatrolLog[] = [];
  const seenInMinute = new Set<string>();
  existingLogs.forEach(l => {
    const norm = normalizeTag(l.tag);
    const key = `${l.date}_${l.time.substring(0, 5)}_${norm}`;
    if (!seenInMinute.has(key)) {
      initialLogs.push({ 
        ...l, 
        tag: tagMap.get(norm) || l.tag, 
        isGenerated: !!l.isGenerated 
      });
      seenInMinute.add(key);
    }
  });

  let allLogs: PatrolLog[] = [...initialLogs];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // 3. Selezione dei tag target: UNICI e limitati a tagsPerSite
  const allUniqueTagsNorm = Array.from(tagMap.keys());
  const targetTagsNorm = allUniqueTagsNorm.slice(0, tagsPerSite);
  const targetTags = targetTagsNorm.map(norm => tagMap.get(norm)!);

  // 3. Generazione finestre di turno (Shift Windows)
  interface ShiftWindow {
    startAbs: number;
    endAbs: number;
    roundsTarget: number;
  }
  const shiftWindows: ShiftWindow[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const currentDate = new Date(year, month, d);
    const dayOfWeek = currentDate.getDay();

    let currentDayConfig: DayConfig;
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

    if (currentDayConfig.nightEnabled) {
      const startAbs = getAbsoluteMinutes(currentDateStr, nightStart);
      let endAbs = getAbsoluteMinutes(currentDateStr, nightEnd);
      if (toMinutes(nightEnd) <= toMinutes(nightStart)) endAbs += (24 * 60);
      shiftWindows.push({ startAbs, endAbs, roundsTarget: currentDayConfig.rounds });
    }

    if (currentDayConfig.dayEnabled) {
      const startAbs = getAbsoluteMinutes(currentDateStr, dayStart);
      let endAbs = getAbsoluteMinutes(currentDateStr, dayEnd);
      if (toMinutes(dayEnd) <= toMinutes(dayStart)) endAbs += (24 * 60);
      shiftWindows.push({ startAbs, endAbs, roundsTarget: currentDayConfig.rounds });
    }
  }

    // 4. Elaborazione di ogni finestra di turno
    shiftWindows.forEach(window => {
      // Aumentiamo il margine a 180 minuti (3 ore) per intercettare giri molto anticipati (comuni nei turni di mezzanotte)
      const logsInWindow = allLogs.filter(l => {
        const logAbs = getAbsoluteMinutes(l.date, l.time);
        return logAbs >= (window.startAbs - 180) && logAbs <= (window.endAbs + 60);
      }).sort((a, b) => getAbsoluteMinutes(a.date, a.time) - getAbsoluteMinutes(b.date, b.time));

      // Raggruppa in giri
      const rounds: PatrolLog[][] = [];
      if (logsInWindow.length > 0) {
        let currentRound: PatrolLog[] = [logsInWindow[0]];
        for (let i = 1; i < logsInWindow.length; i++) {
          const diff = getAbsoluteMinutes(logsInWindow[i].date, logsInWindow[i].time) - 
                       getAbsoluteMinutes(logsInWindow[i-1].date, logsInWindow[i-1].time);
          if (diff > 45) {
            rounds.push(currentRound);
            currentRound = [];
          }
          currentRound.push(logsInWindow[i]);
        }
        rounds.push(currentRound);
      }

      // A. Completa i giri esistenti
      rounds.forEach(round => {
        const tagsInRoundNorm = new Set(round.map(l => normalizeTag(l.tag)));
        if (round.length < tagsPerSite) {
          const lastLog = round[round.length - 1];
          let cursor = getAbsoluteMinutes(lastLog.date, lastLog.time) + getRandomInt(tagIntervalMin, tagIntervalMax);
          
          for (const tagNorm of targetTagsNorm) {
            if (round.length >= tagsPerSite) break;
            if (!tagsInRoundNorm.has(tagNorm)) {
              const { date, time } = fromAbsoluteMinutes(cursor);
              const newLog = { date, time, tag: tagMap.get(tagNorm)!, isGenerated: true };
              allLogs.push(newLog);
              round.push(newLog);
              tagsInRoundNorm.add(tagNorm);
              cursor += getRandomInt(tagIntervalMin, tagIntervalMax);
            }
          }
        }
      });

      // B. Aggiungi giri mancanti se necessario
      let roundsNeeded = window.roundsTarget - rounds.length;
      
      if (roundsNeeded > 0) {
        const shiftDuration = window.endAbs - window.startAbs;
        
        // Proviamo a inserire i giri mancanti cercando i buchi temporali più grandi
        for (let attempt = 0; attempt < 10 && roundsNeeded > 0; attempt++) {
          // Ordiniamo i giri attuali per tempo
          const sortedRounds = [...rounds].sort((a, b) => getAbsoluteMinutes(a[0].date, a[0].time) - getAbsoluteMinutes(b[0].date, b[0].time));
          
          // Troviamo il buco più grande
          let maxGap = 0;
          let gapStart = -1;
          let gapEnd = -1;
          
          const timePoints = [window.startAbs, ...sortedRounds.map(r => getAbsoluteMinutes(r[0].date, r[0].time)), window.endAbs];
          
          for (let j = 0; j < timePoints.length - 1; j++) {
            const gap = timePoints[j+1] - timePoints[j];
            if (gap > maxGap) {
              maxGap = gap;
              gapStart = timePoints[j];
              gapEnd = timePoints[j+1];
            }
          }

          // Se il buco è troppo piccolo (< 40 min), smettiamo
          if (maxGap < 40 && attempt > 0) break;

          // Invece del centro esatto, scegliamo un punto casuale nel "cuore" del buco (tra il 25% e il 75%)
          // Questo evita che i giri siano sempre alla stessa ora ogni giorno
          const randomFactor = (Math.random() * 0.5) + 0.25; 
          let targetTime = gapStart + (maxGap * randomFactor);
          
          // Aggiungiamo un jitter casuale ulteriore
          const jitter = getRandomInt(-20, 20);
          let cursor = targetTime + jitter;
          
          // Margine di sicurezza dai bordi del turno
          cursor = Math.max(window.startAbs + 15, Math.min(cursor, window.endAbs - (tagsPerSite * tagIntervalMax) - 15));

          const newRound: PatrolLog[] = [];
          targetTags.forEach(tag => {
            const { date, time } = fromAbsoluteMinutes(cursor);
            const newLog = { date, time, tag, isGenerated: true };
            allLogs.push(newLog);
            newRound.push(newLog);
            cursor += getRandomInt(tagIntervalMin, tagIntervalMax);
          });
          
          rounds.push(newRound);
          roundsNeeded--;
        }
      }
    });

  // 5. Deduplicazione finale (stesso tag entro 45 min)
  const sorted = allLogs.sort((a, b) => {
    const diff = getAbsoluteMinutes(a.date, a.time) - getAbsoluteMinutes(b.date, b.time);
    if (diff !== 0) return diff;
    return (a.isGenerated ? 1 : 0) - (b.isGenerated ? 0 : 1);
  });

  const finalResult: PatrolLog[] = [];
  const lastSeenTime = new Map<string, number>();

  sorted.forEach(log => {
    const time = getAbsoluteMinutes(log.date, log.time);
    const norm = normalizeTag(log.tag);
    const lastTime = lastSeenTime.get(norm);

    if (!log.isGenerated) {
      // Rimuovi generati troppo vicini a questo reale
      const index = finalResult.findIndex(r => 
        r.isGenerated && normalizeTag(r.tag) === norm && Math.abs(getAbsoluteMinutes(r.date, r.time) - time) < 45
      );
      if (index !== -1) finalResult.splice(index, 1);
      
      finalResult.push(log);
      lastSeenTime.set(norm, time);
    } else {
      if (lastTime === undefined || (time - lastTime) >= 45) {
        finalResult.push(log);
        lastSeenTime.set(norm, time);
      }
    }
  });

  return finalResult.sort((a, b) => getAbsoluteMinutes(a.date, a.time) - getAbsoluteMinutes(b.date, b.time));
};

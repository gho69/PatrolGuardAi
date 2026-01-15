
import { PatrolLog, SiteConfig } from '../types';

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
    month, year, roundsPerShift, tagsPerSite, 
    nightShiftEnabled, dayShiftEnabled,
    nightStart, nightEnd, dayStart, dayEnd,
    tagIntervalMin, tagIntervalMax
  } = config;

  // Partiamo con i log esistenti (reali) che non devono essere toccati
  let finalLogs: PatrolLog[] = [...existingLogs.map(l => ({ ...l, isGenerated: false }))];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Determinazione dei tag da utilizzare
  const uniqueTagsInFile = Array.from(new Set(existingLogs.map(l => l.tag)));
  const baseTagNames = uniqueTagsInFile.length > 0 ? uniqueTagsInFile : config.tagNames;
  const targetTags = baseTagNames.slice(0, tagsPerSite);

  for (let d = 1; d <= daysInMonth; d++) {
    const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const shiftsToProcess = [];
    if (nightShiftEnabled) shiftsToProcess.push({ start: nightStart, end: nightEnd });
    if (dayShiftEnabled) shiftsToProcess.push({ start: dayStart, end: dayEnd });

    shiftsToProcess.forEach(shift => {
      const shiftStartAbs = getAbsoluteMinutes(currentDateStr, shift.start);
      let shiftEndAbs = getAbsoluteMinutes(currentDateStr, shift.end);
      if (toMinutes(shift.end) <= toMinutes(shift.start)) {
        shiftEndAbs += (24 * 60);
      }

      // 1. Identifichiamo i log reali in questo turno
      const logsInShift = finalLogs.filter(l => {
        const logAbs = getAbsoluteMinutes(l.date, l.time);
        // Tolleranza per log che iniziano poco prima del turno
        return logAbs >= (shiftStartAbs - 60) && logAbs <= (shiftEndAbs + 60) && !l.isGenerated;
      }).sort((a, b) => getAbsoluteMinutes(a.date, a.time) - getAbsoluteMinutes(b.date, b.time));

      // 2. Raggruppiamo i log reali in giri esistenti
      const roundsFound: PatrolLog[][] = [];
      if (logsInShift.length > 0) {
        let currentGroup: PatrolLog[] = [logsInShift[0]];
        for (let i = 1; i < logsInShift.length; i++) {
          const diff = getAbsoluteMinutes(logsInShift[i].date, logsInShift[i].time) - 
                       getAbsoluteMinutes(logsInShift[i-1].date, logsInShift[i-1].time);
          if (diff > 45) { // Se passa più di 45 min, è un altro giro
            roundsFound.push(currentGroup);
            currentGroup = [];
          }
          currentGroup.push(logsInShift[i]);
        }
        roundsFound.push(currentGroup);
      }

      // 3. COMPLETAMENTO GIRI ESISTENTI (Senza sovrascrivere i reali)
      roundsFound.forEach(round => {
        const tagsInRound = new Set(round.map(l => l.tag));
        // Prendiamo l'ultimo orario del giro esistente per continuare da lì
        const lastLog = round[round.length - 1];
        let timeCursor = getAbsoluteMinutes(lastLog.date, lastLog.time);

        targetTags.forEach(tagName => {
          if (!tagsInRound.has(tagName)) {
            // Aggiungiamo solo i tag che mancano nel giro
            timeCursor += getRandomInt(tagIntervalMin, tagIntervalMax);
            const tagDate = new Date(timeCursor * 60 * 1000);
            finalLogs.push({
              date: tagDate.toISOString().split('T')[0],
              time: fromMinutes(toMinutes(tagDate.toISOString().split('T')[1].substring(0, 5))),
              tag: tagName,
              isGenerated: true
            });
          }
        });
      });

      // 4. GENERAZIONE NUOVI GIRI (Se quelli reali sono meno di quelli richiesti)
      const missingRoundsCount = Math.max(0, roundsPerShift - roundsFound.length);
      if (missingRoundsCount > 0) {
        // Cerchiamo uno spazio libero nel turno
        let nextRoundStartAbs = shiftStartAbs + getRandomInt(30, 90);

        for (let r = 0; r < missingRoundsCount; r++) {
          // Evitiamo sovrapposizioni con giri reali o appena generati
          const overlap = finalLogs.some(l => {
            const abs = getAbsoluteMinutes(l.date, l.time);
            return Math.abs(nextRoundStartAbs - abs) < 120;
          });

          if (overlap) {
            nextRoundStartAbs += 150;
            if (nextRoundStartAbs > shiftEndAbs - 30) break;
            r--; continue;
          }

          if (nextRoundStartAbs > shiftEndAbs - 30) break;

          let tagCursor = nextRoundStartAbs;
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

          nextRoundStartAbs += (120 + getRandomInt(60, 120));
        }
      }
    });
  }

  // Deduplicazione finale e ordinamento
  const uniqueMap = new Map<string, PatrolLog>();
  finalLogs.forEach(l => {
    const key = `${l.date}_${l.time.substring(0, 5)}_${l.tag}`;
    // Preferiamo sempre il dato reale se esiste un duplicato generato
    if (!uniqueMap.has(key) || !l.isGenerated) {
      uniqueMap.set(key, l);
    }
  });

  return Array.from(uniqueMap.values()).sort((a, b) => {
    return getAbsoluteMinutes(a.date, a.time) - getAbsoluteMinutes(b.date, b.time);
  });
};

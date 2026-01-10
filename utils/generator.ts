
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

  // Risultato finale (partiamo vuoti e ripopoliamo per controllare meglio i tempi)
  let finalLogs: PatrolLog[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Definiamo i tag target (se il file ha tag, usiamo quelli, altrimenti i default)
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

      // Troviamo i log reali in questo turno
      const logsInShift = existingLogs.filter(l => {
        const logAbs = getAbsoluteMinutes(l.date, l.time);
        return logAbs >= (shiftStartAbs - 120) && logAbs <= (shiftEndAbs + 60);
      }).sort((a, b) => getAbsoluteMinutes(a.date, a.time) - getAbsoluteMinutes(b.date, b.time));

      // Raggruppiamo i log reali in "giri" individuati
      const roundsFound: PatrolLog[][] = [];
      if (logsInShift.length > 0) {
        let currentGroup: PatrolLog[] = [logsInShift[0]];
        for (let i = 1; i < logsInShift.length; i++) {
          const diff = getAbsoluteMinutes(logsInShift[i].date, logsInShift[i].time) - 
                       getAbsoluteMinutes(logsInShift[i-1].date, logsInShift[i-1].time);
          if (diff > 40) {
            roundsFound.push(currentGroup);
            currentGroup = [];
          }
          currentGroup.push(logsInShift[i]);
        }
        roundsFound.push(currentGroup);
      }

      /**
       * GESTIONE GIRI ESISTENTI (Ricalibrazione Tempi)
       * Per ogni giro trovato nel file, prendiamo l'orario del primo tag e ricalcoliamo 
       * tutti i successivi per forzare l'intervallo 1-3 minuti.
       */
      roundsFound.forEach(round => {
        let timeCursor = getAbsoluteMinutes(round[0].date, round[0].time);
        
        targetTags.forEach((tagName, index) => {
          // Determiniamo se questo tag era presente nel file originale (per marcarlo REAL/AUTO)
          const wasInOriginal = round.some(l => l.tag === tagName);
          
          const tagDate = new Date(timeCursor * 60 * 1000);
          finalLogs.push({
            date: tagDate.toISOString().split('T')[0],
            time: fromMinutes(toMinutes(tagDate.toISOString().split('T')[1].substring(0, 5))),
            tag: tagName,
            isGenerated: !wasInOriginal
          });

          // Incrementiamo il cursore del tempo sempre di 1-3 minuti (configurabili)
          timeCursor += getRandomInt(tagIntervalMin, tagIntervalMax);
        });
      });

      /**
       * GENERAZIONE GIRI MANCANTI
       */
      const roundsToCreate = Math.max(0, roundsPerShift - roundsFound.length);
      if (roundsToCreate > 0) {
        // Iniziamo a generare un po' dopo l'inizio del turno o dopo l'ultimo giro reale
        let nextRoundStartAbs = shiftStartAbs + getRandomInt(20, 50);

        for (let r = 0; r < roundsToCreate; r++) {
          // Verifica sovrapposizione con giri già inseriti
          const overlap = finalLogs.some(l => {
             const abs = getAbsoluteMinutes(l.date, l.time);
             return Math.abs(nextRoundStartAbs - abs) < 100;
          });

          if (overlap) {
            nextRoundStartAbs += 130;
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

          nextRoundStartAbs += (120 + getRandomInt(30, 60));
        }
      }
    });
  }

  // Ordinamento finale per data e ora
  return finalLogs.sort((a, b) => {
    return getAbsoluteMinutes(a.date, a.time) - getAbsoluteMinutes(b.date, b.time);
  });
};

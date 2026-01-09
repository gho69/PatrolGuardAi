
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

const isTimeInRange = (time: string, start: string, end: string): boolean => {
  const t = toMinutes(time);
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s <= e) return t >= s && t <= e;
  return t >= s || t <= e;
};

export const generateMissingData = (
  existingLogs: PatrolLog[],
  config: SiteConfig
): PatrolLog[] => {
  const { 
    month, year, roundsPerShift, tagsPerSite, 
    nightShiftEnabled, dayShiftEnabled,
    nightStart, nightEnd, dayStart, dayEnd 
  } = config;

  let results: PatrolLog[] = [...existingLogs];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Estraiamo i nomi dei tag unici dai dati importati per usarli nella generazione
  const uniqueTagsInFile = Array.from(new Set(existingLogs.map(l => l.tag)));
  const baseTagNames = uniqueTagsInFile.length > 0 ? uniqueTagsInFile : config.tagNames;
  const targetTags = baseTagNames.slice(0, tagsPerSite);

  const shifts = [];
  if (nightShiftEnabled) shifts.push({ start: nightStart, end: nightEnd });
  if (dayShiftEnabled) shifts.push({ start: dayStart, end: dayEnd });

  for (let d = 1; d <= daysInMonth; d++) {
    const currentDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    shifts.forEach(shift => {
      const logsInShift = results.filter(l => l.date === currentDate && isTimeInRange(l.time, shift.start, shift.end));
      
      const sortedLogs = [...logsInShift].sort((a, b) => {
        let relA = toMinutes(a.time) - toMinutes(shift.start); if (relA < 0) relA += 1440;
        let relB = toMinutes(b.time) - toMinutes(shift.start); if (relB < 0) relB += 1440;
        return relA - relB;
      });

      const roundsFound: PatrolLog[][] = [];
      if (sortedLogs.length > 0) {
        let currentGroup: PatrolLog[] = [sortedLogs[0]];
        for (let i = 1; i < sortedLogs.length; i++) {
          let diff = toMinutes(sortedLogs[i].time) - toMinutes(sortedLogs[i-1].time); if (diff < 0) diff += 1440;
          if (diff > 45) { // Un nuovo giro se passano più di 45 min
            roundsFound.push(currentGroup);
            currentGroup = [];
          }
          currentGroup.push(sortedLogs[i]);
        }
        roundsFound.push(currentGroup);
      }

      // 1. Integra tag mancanti nei giri esistenti
      roundsFound.forEach(round => {
        const tagsPresenti = new Set(round.map(l => l.tag));
        const startTime = toMinutes(round[0].time);
        targetTags.forEach((tagName, idx) => {
          if (!tagsPresenti.has(tagName)) {
            results.push({
              date: currentDate,
              time: fromMinutes(startTime + (idx * 2)),
              tag: tagName,
              isGenerated: true
            });
          }
        });
      });

      // 2. Crea giri mancanti (Distacco 1.5 - 2 ore)
      const roundsToCreate = Math.max(0, roundsPerShift - roundsFound.length);
      let lastRoundStartTime = roundsFound.length > 0 ? 
        toMinutes(roundsFound[roundsFound.length - 1][0].time) : 
        toMinutes(shift.start);

      for (let r = 0; r < roundsToCreate; r++) {
        // Aggiungi 110-130 minuti dal giro precedente
        lastRoundStartTime += (110 + getRandomInt(0, 20));
        let currentTime = lastRoundStartTime;
        
        targetTags.forEach((tagName, tIdx) => {
          results.push({
            date: currentDate,
            time: fromMinutes(currentTime + (tIdx * getRandomInt(1, 3))),
            tag: tagName,
            isGenerated: true
          });
        });
      }
    });
  }

  // Rimuovi duplicati e ordina
  const finalMap = new Map<string, PatrolLog>();
  results.forEach(l => {
    const key = `${l.date}_${l.time.substring(0, 5)}_${l.tag}`;
    if (!finalMap.has(key) || !l.isGenerated) finalMap.set(key, l);
  });

  return Array.from(finalMap.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });
};

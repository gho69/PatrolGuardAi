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

// Helper fondamentale per calcolare la corretta data fisica sul calendario.
// Se un'ora di log è inferiore all'ora di inizio del turno (ad es. log alle 01:20 in un turno che inizia alle 23:00 del giorno operativo),
// e il turno attraversa la mezzanotte, significa che il log ricade fisicamente nell'inizio del giorno successivo alla data operativa di inizio del turno.
// Se invece il log è ad un'ora grande (es. 21:45 o 22:17), è un inizio anticipato prima di mezzanotte ed avviene lo stesso giorno.
const getCorrectPhysicalDate = (
  operationalDateStr: string, 
  timeStr: string, 
  startHour: number,
  spansMidnight: boolean
): string => {
  const [y, m, d] = operationalDateStr.split('-').map(Number);
  const [h] = timeStr.split(':').map(Number);
  
  if (spansMidnight) {
    // Se il turno attraversa la mezzanotte, i log eseguiti post-mezzanotte (ore piccole, es. h < startHour e h < 12)
    // avvengono fisicamente il giorno successivo rispetto alla data d'inizio turno.
    if (h < startHour && h < 12) {
      const dObj = new Date(y, m - 1, d + 1);
      const year = dObj.getFullYear();
      const month = String(dObj.getMonth() + 1).padStart(2, '0');
      const day = String(dObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  
  return operationalDateStr;
};

export const generateMissingData = (
  existingLogs: PatrolLog[],
  config: SiteConfig
): PatrolLog[] => {
  const { 
    month, year, tagsPerSite, 
    nightStart, nightEnd,
    dayShift1Start, dayShift1End,
    dayShift2Start, dayShift2End,
    tagIntervalMin, tagIntervalMax
  } = config;

  // 1. Mappa dei tag per preservare il formato originale e ripulire tag generici
  const tagMap = new Map<string, string>();
  const isGeneric = (t: string) => {
    const norm = t.toLowerCase().replace(/[:\s]+/g, ' ').trim();
    return (
      norm === 'reale' || 
      norm === 'operatore' || 
      norm === 'ispezione' ||
      norm === 'ispezione reale' || 
      norm === 'ispezione operatore' ||
      norm.includes('system') || 
      norm.includes('gps') ||
      norm.includes('inizio giro') ||
      norm.includes('fine giro') ||
      norm.includes('automatico') ||
      norm.includes('pattuglia') ||
      norm.includes('sospes') ||
      norm.includes('ripres') ||
      norm.includes('annullat') ||
      norm.includes('fallit') ||
      norm.includes('incomplet') ||
      norm.includes('parzial') ||
      norm.includes('allarme') ||
      norm.includes('anomalia') ||
      norm.includes('guasto') ||
      norm.includes('manutenzione') ||
      norm.includes('batteria') ||
      norm.includes('alimentazione') ||
      norm.includes('test') ||
      norm.includes('arrivo sul posto') ||
      !isNaN(Number(t.trim()))
    );
  };

  config.tagNames.forEach(t => {
    if (isGeneric(t)) return;
    const norm = normalizeTag(t);
    if (!tagMap.has(norm)) tagMap.set(norm, t.trim());
  });
  
  existingLogs.forEach(l => {
    if (isGeneric(l.tag)) return;
    const norm = normalizeTag(l.tag);
    if (!tagMap.has(norm)) tagMap.set(norm, l.tag.trim());
  });

  // 2. Normalizzazione log esistenti
  const initialLogs: PatrolLog[] = [];
  const seenInMinute = new Set<string>();
  existingLogs.forEach(l => {
    // Filtriamo e scartiamo i log generati in precedenza per consentire una rigenerazione pulita e idempotente
    if (l.isGenerated) return;
    const norm = normalizeTag(l.tag);
    const key = `${l.date}_${l.time.substring(0, 5)}_${norm}`;
    if (!seenInMinute.has(key)) {
      initialLogs.push({ 
        ...l, 
        tag: tagMap.get(norm) || l.tag, 
        isGenerated: false
      });
      seenInMinute.add(key);
    }
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // 3. Selezione dei tag target: UNICI e limitati a tagsPerSite configurato
  const allUniqueTagsNorm = Array.from(tagMap.keys());
  const targetTagsNorm = allUniqueTagsNorm.slice(0, tagsPerSite);
  const targetTags = targetTagsNorm.map(norm => tagMap.get(norm)!);

  // 3. Generazione delle finestre di turno (Shift Windows)
  interface ShiftWindow {
    startAbs: number;
    endAbs: number;
    roundsTarget: number;
    operationalDateStr: string;
    startHour: number;
    spansMidnight: boolean;
  }
  const shiftWindows: ShiftWindow[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const currentDate = new Date(year, month, d);
    const dayOfWeek = currentDate.getDay();

    let currentDayConfig: DayConfig;
    if (dayOfWeek === 6) {
      currentDayConfig = config.saturdayConfig;
    } else if (dayOfWeek === 0) {
      currentDayConfig = config.sundayConfig;
    } else {
      currentDayConfig = {
        nightEnabled: config.nightShiftEnabled,
        day1Enabled: config.dayShift1Enabled,
        day2Enabled: config.dayShift2Enabled,
        rounds: config.roundsPerShift,
        nightRounds: config.roundsPerShift,
        day1Rounds: config.roundsPerShift,
        day2Rounds: config.roundsPerShift
      };
    }

    if (config.customRoundSlotsEnabled && config.customRoundSlots && config.customRoundSlots.length > 0) {
      // Modalità Fasce Orarie Specifiche per Giro ed Aperture
      const activeSlots = config.customRoundSlots.filter(s => {
        if (!s.enabled) return false;
        if (!s.daysFilter || s.daysFilter === 'all') return true;
        if (s.daysFilter === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
        if (s.daysFilter === 'weekend') return dayOfWeek === 0 || dayOfWeek === 6;
        return true;
      });

      activeSlots.forEach(slot => {
        const startAbs = getAbsoluteMinutes(currentDateStr, slot.startTime);
        let endAbs = getAbsoluteMinutes(currentDateStr, slot.endTime);
        const spansMidnight = toMinutes(slot.endTime) < toMinutes(slot.startTime);
        if (spansMidnight) endAbs += (24 * 60);
        const startHour = parseInt(slot.startTime.split(':')[0]);
        shiftWindows.push({
          startAbs,
          endAbs,
          roundsTarget: 1, // ogni fascia specifica rappresenta 1 singolo giro/apertura
          operationalDateStr: currentDateStr,
          startHour,
          spansMidnight
        });
      });
    } else {
      // Modalità Turni Generali Standard
      if (currentDayConfig.nightEnabled) {
        const startAbs = getAbsoluteMinutes(currentDateStr, nightStart);
        let endAbs = getAbsoluteMinutes(currentDateStr, nightEnd);
        const spansMidnight = toMinutes(nightEnd) <= toMinutes(nightStart);
        if (spansMidnight) endAbs += (24 * 60);
        const startHour = parseInt(nightStart.split(':')[0]);
        const targetRounds = currentDayConfig.nightRounds ?? currentDayConfig.rounds ?? config.roundsPerShift;
        if (targetRounds > 0) {
          shiftWindows.push({ startAbs, endAbs, roundsTarget: targetRounds, operationalDateStr: currentDateStr, startHour, spansMidnight });
        }
      }

      if (currentDayConfig.day1Enabled) {
        const startAbs = getAbsoluteMinutes(currentDateStr, dayShift1Start);
        let endAbs = getAbsoluteMinutes(currentDateStr, dayShift1End);
        const spansMidnight = toMinutes(dayShift1End) <= toMinutes(dayShift1Start);
        if (spansMidnight) endAbs += (24 * 60);
        const startHour = parseInt(dayShift1Start.split(':')[0]);
        const targetRounds = currentDayConfig.day1Rounds ?? currentDayConfig.rounds ?? config.roundsPerShift;
        if (targetRounds > 0) {
          shiftWindows.push({ startAbs, endAbs, roundsTarget: targetRounds, operationalDateStr: currentDateStr, startHour, spansMidnight });
        }
      }

      if (currentDayConfig.day2Enabled) {
        const startAbs = getAbsoluteMinutes(currentDateStr, dayShift2Start);
        let endAbs = getAbsoluteMinutes(currentDateStr, dayShift2End);
        const spansMidnight = toMinutes(dayShift2End) <= toMinutes(dayShift2Start);
        if (spansMidnight) endAbs += (24 * 60);
        const startHour = parseInt(dayShift2Start.split(':')[0]);
        const targetRounds = currentDayConfig.day2Rounds ?? currentDayConfig.rounds ?? config.roundsPerShift;
        if (targetRounds > 0) {
          shiftWindows.push({ startAbs, endAbs, roundsTarget: targetRounds, operationalDateStr: currentDateStr, startHour, spansMidnight });
        }
      }
    }
  }

  // Mappa per associare ciascun log reale alla sua finestra di turno più vicina
  const windowLogsMap = new Map<number, PatrolLog[]>();
  shiftWindows.forEach((_, idx) => windowLogsMap.set(idx, []));
  
  const leftoverLogs: PatrolLog[] = [];

  initialLogs.forEach(l => {
    const logAbs = getAbsoluteMinutes(l.date, l.time);
    
    let closestWindowIdx = -1;
    let minDistance = Infinity;
    
    shiftWindows.forEach((window, idx) => {
      // Distanza del log rispetto alla finestra [startAbs, endAbs]
      const dist = Math.max(0, window.startAbs - logAbs) + Math.max(0, logAbs - window.endAbs);
      if (dist < minDistance) {
        minDistance = dist;
        closestWindowIdx = idx;
      }
    });
    
    // Una tolleranza di 150 minuti (2h30m) cattura perfettamente passaggi eseguiti in anticipo o leggermente in ritardo
    if (closestWindowIdx !== -1 && minDistance <= 150) {
      windowLogsMap.get(closestWindowIdx)!.push(l);
    } else {
      leftoverLogs.push(l);
    }
  });

  let allCompletedLogs: PatrolLog[] = [...leftoverLogs];

  // 4. Elaborazione di ogni finestra di turno
  shiftWindows.forEach((window, idx) => {
    const logsInWindow = windowLogsMap.get(idx) || [];

    // Ordiniamo cronologicamente
    logsInWindow.sort((a, b) => getAbsoluteMinutes(a.date, a.time) - getAbsoluteMinutes(b.date, b.time));

    // Raggruppamento in giri basandoci su intervalli di marcatura di 45 min
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

    // Pulizia e normalizzazione dei giri reali
    const cleanedRounds: PatrolLog[][] = [];
    rounds.forEach(round => {
      const uniqueTagsMap = new Map<string, PatrolLog>();
      round.forEach(l => {
        const norm = normalizeTag(l.tag);
        if (!uniqueTagsMap.has(norm)) {
          uniqueTagsMap.set(norm, l);
        }
      });
      
      // Ordina e limita rigorosamente a tagsPerSite configurato
      let uniqueLogs = Array.from(uniqueTagsMap.values())
        .sort((a, b) => getAbsoluteMinutes(a.date, a.time) - getAbsoluteMinutes(b.date, b.time));
        
      if (uniqueLogs.length > tagsPerSite) {
        uniqueLogs = uniqueLogs.slice(0, tagsPerSite);
      }
      cleanedRounds.push(uniqueLogs);
    });

    // Completamento dei giri reali esistenti
    cleanedRounds.forEach(round => {
      if (round.length === 0) return;
      const tagsInRoundNorm = new Set(round.map(l => normalizeTag(l.tag)));
      
      if (round.length < tagsPerSite) {
        const lastLog = round[round.length - 1];
        let cursor = getAbsoluteMinutes(lastLog.date, lastLog.time) + getRandomInt(tagIntervalMin, tagIntervalMax);
        
        for (const tagNorm of targetTagsNorm) {
          if (round.length >= tagsPerSite) break;
          if (!tagsInRoundNorm.has(tagNorm)) {
            const { date, time } = fromAbsoluteMinutes(cursor);
            const correctDate = getCorrectPhysicalDate(window.operationalDateStr, time, window.startHour, window.spansMidnight);
            const tagLabel = tagMap.get(tagNorm) || (targetTagsNorm.indexOf(tagNorm) < config.tagNames.length ? config.tagNames[targetTagsNorm.indexOf(tagNorm)] : tagNorm);
            const newLog = { date: correctDate, time, tag: tagLabel, isGenerated: true };
            round.push(newLog);
            tagsInRoundNorm.add(tagNorm);
            cursor += getRandomInt(tagIntervalMin, tagIntervalMax);
          }
        }
      }
      
      // Applichiamo la corretta data fisica sul calendario per tutti i log di questo giro completato
      round.forEach(l => {
        l.date = getCorrectPhysicalDate(window.operationalDateStr, l.time, window.startHour, window.spansMidnight);
      });

      allCompletedLogs.push(...round);
    });

    // Aggiungiamo i giri interamente mancanti se necessari
    let roundsNeeded = window.roundsTarget - cleanedRounds.length;
    
    if (roundsNeeded > 0) {
      for (let attempt = 0; attempt < 10 && roundsNeeded > 0; attempt++) {
        const sortedRounds = [...cleanedRounds].sort((a, b) => {
          if (a.length === 0 || b.length === 0) return 0;
          return getAbsoluteMinutes(a[0].date, a[0].time) - getAbsoluteMinutes(b[0].date, b[0].time);
        });
        
        // Troviamo il buco temporale più grande all'interno del turno per distanziare/spalmare i passaggi
        let maxGap = 0;
        let gapStart = -1;
        let gapEnd = -1;
        
        const timePoints = [
          window.startAbs, 
          ...sortedRounds.map(r => getAbsoluteMinutes(r[0].date, r[0].time)), 
          window.endAbs
        ];
        
        for (let j = 0; j < timePoints.length - 1; j++) {
          const gap = timePoints[j+1] - timePoints[j];
          if (gap > maxGap) {
            maxGap = gap;
            gapStart = timePoints[j];
            gapEnd = timePoints[j+1];
          }
        }

        if (maxGap < 40 && attempt > 0) break;

        const windowDuration = window.endAbs - window.startAbs;
        const approxRoundDuration = Math.max(0, (tagsPerSite - 1) * Math.floor((tagIntervalMin + tagIntervalMax) / 2));

        let cursor: number;
        if (windowDuration <= approxRoundDuration + 5) {
          // Finestra stretta, esatta o per orario fisso (es. Apertura 04:30)
          cursor = window.startAbs;
        } else {
          const randomFactor = (Math.random() * 0.4) + 0.3; // Distribuzione bilanciata nella fascia
          let targetTime = gapStart + (maxGap * randomFactor);
          const jitter = getRandomInt(-5, 5);
          cursor = targetTime + jitter;

          const minCursor = window.startAbs;
          const maxCursor = Math.max(window.startAbs, window.endAbs - approxRoundDuration);
          cursor = Math.max(minCursor, Math.min(cursor, maxCursor));
        }

        const newRound: PatrolLog[] = [];
        targetTags.forEach(tag => {
          const { time } = fromAbsoluteMinutes(cursor);
          // Calcoliamo la corretta data fisica per la marcatura (soprattutto in ore notturne post-mezzanotte)
          const correctDate = getCorrectPhysicalDate(window.operationalDateStr, time, window.startHour, window.spansMidnight);
          const newLog = { 
            date: correctDate, 
            time, 
            tag, 
            isGenerated: true 
          };
          newRound.push(newLog);
          cursor += getRandomInt(tagIntervalMin, tagIntervalMax);
        });
        
        allCompletedLogs.push(...newRound);
        cleanedRounds.push(newRound);
        roundsNeeded--;
      }
    }
  });

  // 5. Deduplicazione finale (rimuoviamo duplicati entro 45 min)
  const sorted = allCompletedLogs.sort((a, b) => {
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

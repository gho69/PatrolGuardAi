
import { PatrolLog } from '../types';

/**
 * Parsa il file TXT escludendo messaggi di sistema, arrivi automatici e log di servizio.
 */
export const parsePatrolFile = (content: string): PatrolLog[] => {
  const lines = content.split('\n');
  const logs: PatrolLog[] = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes(';')) return;

    const parts = trimmed.split(';');
    const dateTimePart = parts[1]?.trim();
    
    let tagPart = "";
    
    // Cerchiamo tra tutte le parti dal terzo elemento in poi
    for (let i = 2; i < parts.length; i++) {
      const p = parts[i].trim();
      if (!p || p.length < 3) continue;
      
      // Normalizziamo per il controllo: rimuoviamo i due punti e gli spazi multipli
      const norm = p.toLowerCase().replace(/[:\s]+/g, ' ').trim();
      
      // Verifichiamo se è un messaggio di stato generico
      const isStatus = 
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
        norm.includes('pattuglia');
        
      if (!isStatus && isNaN(Number(p))) {
        tagPart = p;
        break;
      }
    }

    if (!tagPart) return;

    const cleanTag = tagPart.replace(/:$/, '').replace(/\s+/g, ' ').trim();
    const lowerTagNormalized = cleanTag.toLowerCase().replace(/[:\s]+/g, ' ').trim();
    
    // FILTRI RIGOROSI: Escludiamo tutto ciò che non è un'ispezione effettiva
    const isInvalid = 
      !isNaN(Number(cleanTag)) || 
      lowerTagNormalized === 'reale' ||
      lowerTagNormalized === 'operatore' ||
      lowerTagNormalized === 'ispezione' ||
      lowerTagNormalized === 'ispezione reale' ||
      lowerTagNormalized === 'ispezione operatore' ||
      lowerTagNormalized.includes('fine giro') || 
      lowerTagNormalized.includes('inizio giro') || 
      lowerTagNormalized.includes('system') || 
      lowerTagNormalized.includes('arrivo sul posto') ||
      lowerTagNormalized.includes('automatico') ||
      lowerTagNormalized.includes('pattuglia') ||
      lowerTagNormalized.includes('gps') ||
      cleanTag.length < 4;

    if (isInvalid) return;

    if (dateTimePart && dateTimePart.includes(' ')) {
      const [dateStr, timeStr] = dateTimePart.split(' ');
      const dateParts = dateStr.split('/');
      if (dateParts.length === 3) {
        const normalizedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
        const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;

        logs.push({
          date: normalizedDate,
          time: normalizedTime,
          tag: cleanTag, // Manteniamo il formato originale (es. "Ispezione: 1...")
          isGenerated: false
        });
      }
    }
  });

  return logs;
};

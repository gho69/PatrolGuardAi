
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
    const inspectionPart = parts.find(p => p.toLowerCase().includes('ispezione:'));
    
    if (inspectionPart) {
      tagPart = inspectionPart.trim();
    } else {
      for (let i = 2; i < parts.length; i++) {
        const p = parts[i].trim().replace(/:$/, ''); 
        if (p.length > 3 && isNaN(Number(p)) && !p.toLowerCase().includes('system')) {
          tagPart = p;
          break;
        }
      }
    }

    if (!tagPart) return;

    const cleanTag = tagPart.replace(/:$/, '').trim();
    const lowerTag = cleanTag.toLowerCase();
    
    // FILTRI RIGOROSI: Escludiamo tutto ciò che non è un'ispezione effettiva
    const isInvalid = 
      !isNaN(Number(cleanTag)) || 
      lowerTag.includes('fine giro') || 
      lowerTag.includes('inizio giro') || 
      lowerTag.includes('system') || 
      lowerTag.includes('arrivo sul posto') ||
      lowerTag.includes('automatico') ||
      lowerTag.includes('pattuglia') ||
      lowerTag.includes('gps') ||
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
          tag: cleanTag,
          isGenerated: false
        });
      }
    }
  });

  return logs;
};

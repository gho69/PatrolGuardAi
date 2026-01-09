
import { PatrolLog } from '../types';

/**
 * Parsa il file TXT basandosi sul formato:
 * E;13/12/2025 02:28;0000030031;Ispezione: PORTINERIA;
 */
export const parsePatrolFile = (content: string): PatrolLog[] => {
  const lines = content.split('\n');
  const logs: PatrolLog[] = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes(';')) return;

    const parts = trimmed.split(';');
    // Il timestamp è solitamente nella seconda parte (indice 1)
    const dateTimePart = parts[1]?.trim();
    
    // Cerchiamo la parte che contiene il nome del tag (solitamente contiene "Ispezione")
    // Cerchiamo l'ultima parte significativa prima dell'eventuale punto e virgola finale
    let tagPart = "";
    for (let i = parts.length - 1; i >= 2; i--) {
      if (parts[i].trim().length > 5) {
        tagPart = parts[i].trim();
        break;
      }
    }

    if (dateTimePart && dateTimePart.includes(' ')) {
      const [dateStr, timeStr] = dateTimePart.split(' ');
      
      // Normalizziamo la data da DD/MM/YYYY a YYYY-MM-DD per il motore interno
      const dateParts = dateStr.split('/');
      if (dateParts.length === 3) {
        const normalizedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
        
        // Normalizziamo l'ora aggiungendo i secondi se mancano
        const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;

        if (tagPart) {
          logs.push({
            date: normalizedDate,
            time: normalizedTime,
            tag: tagPart,
            isGenerated: false
          });
        }
      }
    }
  });

  return logs;
};

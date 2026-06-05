
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
    
    // Funzione helper per verificare se una stringa è un semplice status o un segnaposto generico
    const isStatusVal = (val: string): boolean => {
      const norm = val.toLowerCase().replace(/[:\s]+/g, ' ').trim();
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
        !isNaN(Number(val))
      );
    };

    let tagPart = "";
    
    // Identificazione intelligente della colonna del tag basandoci sul numero totale di colonne.
    // Tipici formati di linea:
    // 5+ parti -> 0: ID, 1: Data Ora, 2: Tipo Evento (Reale), 3: Nome Operatore, 4: Nome Tag
    // 4 parti  -> 0: ID, 1: Data Ora, 2: Tipo Evento, 3: Nome Tag
    // 3 parti  -> 0: ID, 1: Data Ora, 2: Nome Tag
    if (parts.length >= 5) {
      tagPart = parts[4]?.trim() || "";
      if (!tagPart || isStatusVal(tagPart)) {
        tagPart = parts[3]?.trim() || "";
      }
    } else if (parts.length === 4) {
      tagPart = parts[3]?.trim() || "";
      if (!tagPart || isStatusVal(tagPart)) {
        tagPart = parts[2]?.trim() || "";
      }
    } else if (parts.length === 3) {
      tagPart = parts[2]?.trim() || "";
    }

    if (!tagPart) return;

    const cleanTag = tagPart.replace(/:$/, '').replace(/\s+/g, ' ').trim();
    const lowerTagNormalized = cleanTag.toLowerCase().replace(/[:\s]+/g, ' ').trim();
    
    // FILTRI RIGOROSI: Escludiamo tutto ciò che non è un'ispezione effettiva
    const isInvalid = 
      isStatusVal(cleanTag) ||
      lowerTagNormalized.includes('arrivo sul posto') ||
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

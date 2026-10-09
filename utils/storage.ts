import { ClientProfile } from '../types';
import { DEFAULT_CLIENTS } from '../defaultClients';

const STORAGE_KEY_V2 = 'patrolguard_clients_v2';
const STORAGE_KEY_V1 = 'patrolguard_clients';
const STORAGE_KEY_BACKUP = 'patrolguard_clients_backup';
const SELECTED_CLIENT_KEY = 'patrolguard_selected_client_id';

// IndexedDB Helper
const DB_NAME = 'patrolguard_db';
const DB_VERSION = 1;
const STORE_NAME = 'clients_store';

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getClientsFromIndexedDB(): Promise<ClientProfile[] | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('all_clients');
      req.onsuccess = () => {
        const data = req.result;
        if (Array.isArray(data) && data.length > 0) {
          resolve(data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveClientsToIndexedDB(clients: ClientProfile[]): Promise<void> {
  const db = await openDB();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(clients, 'all_clients');
  } catch (e) {
    console.warn('Errore salvataggio IndexedDB', e);
  }
}

/**
 * Caricamento sincrono iniziale per evitare sfarfallii (localStorage multi-chiave)
 */
export function getInitialClients(): ClientProfile[] {
  if (typeof window === 'undefined') return DEFAULT_CLIENTS;

  const isObsoleteDemoList = (list: ClientProfile[]) => {
    return Array.isArray(list) && list.length > 0 && list.every(c => ['granarolo', 'logistica', 'commerciale'].includes(c.id));
  };

  try {
    const v2 = localStorage.getItem(STORAGE_KEY_V2);
    if (v2) {
      const parsed = JSON.parse(v2);
      if (Array.isArray(parsed) && parsed.length > 0 && !isObsoleteDemoList(parsed)) return parsed;
    }

    const v1 = localStorage.getItem(STORAGE_KEY_V1);
    if (v1) {
      const parsed = JSON.parse(v1);
      if (Array.isArray(parsed) && parsed.length > 0 && !isObsoleteDemoList(parsed)) return parsed;
    }

    const backup = localStorage.getItem(STORAGE_KEY_BACKUP);
    if (backup) {
      const parsed = JSON.parse(backup);
      if (Array.isArray(parsed) && parsed.length > 0 && !isObsoleteDemoList(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Impossibile leggere localStorage (ambiente sandbox o privacy):', e);
  }

  return DEFAULT_CLIENTS;
}

/**
 * Ottiene l'ID del cliente attualmente selezionato in modo sincrono
 */
export function getInitialSelectedClientId(availableClients: ClientProfile[]): string {
  if (typeof window === 'undefined') return availableClients[0]?.id || DEFAULT_CLIENTS[0].id;

  try {
    const saved = localStorage.getItem(SELECTED_CLIENT_KEY);
    if (saved && !['granarolo', 'logistica', 'commerciale'].includes(saved) && availableClients.some(c => c.id === saved)) {
      return saved;
    }
  } catch {}

  return availableClients[0]?.id || DEFAULT_CLIENTS[0].id;
}

/**
 * Salva i profili clienti su tutte le memorie disponibili (Server, LocalStorage, IndexedDB)
 */
export async function persistClients(clients: ClientProfile[]): Promise<void> {
  if (!Array.isArray(clients) || clients.length === 0) return;

  // 1. LocalStorage (ridondanza su più chiavi per sicurezza totale)
  try {
    const json = JSON.stringify(clients);
    localStorage.setItem(STORAGE_KEY_V2, json);
    localStorage.setItem(STORAGE_KEY_V1, json);
    localStorage.setItem(STORAGE_KEY_BACKUP, json);
  } catch (e) {
    console.warn('Scrittura localStorage non consentita o quota superata:', e);
  }

  // 2. IndexedDB (in background)
  saveClientsToIndexedDB(clients);

  // 3. Server-side API (/api/clients) se attivo
  try {
    fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clients)
    }).catch(() => {});
  } catch {}
}

/**
 * Salva l'ID del cliente attivo su tutte le memorie
 */
export async function persistSelectedClientId(clientId: string): Promise<void> {
  if (!clientId) return;

  try {
    localStorage.setItem(SELECTED_CLIENT_KEY, clientId);
  } catch {}

  try {
    fetch('/api/clients/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeId: clientId })
    }).catch(() => {});
  } catch {}
}

/**
 * Recupera l'ID del cliente attivo salvato sul server
 */
export async function fetchRemoteActiveClientId(): Promise<string | null> {
  try {
    const res = await fetch('/api/clients/active');
    if (res.ok) {
      const data = await res.json();
      if (data && data.activeId && !['granarolo', 'logistica', 'commerciale'].includes(data.activeId)) {
        return data.activeId;
      }
    }
  } catch {}
  return null;
}

/**
 * Tenta di sincronizzare i dati dal server (/api/clients) e/o IndexedDB
 */
export async function fetchRemoteClients(): Promise<ClientProfile[] | null> {
  const isObsoleteDemoList = (list: ClientProfile[]) => {
    return Array.isArray(list) && list.length > 0 && list.every(c => ['granarolo', 'logistica', 'commerciale'].includes(c.id));
  };

  // Prova server
  try {
    const res = await fetch('/api/clients');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        if (!isObsoleteDemoList(data)) {
          // Aggiorna anche localStorage e IndexedDB con i dati del server
          try {
            const json = JSON.stringify(data);
            localStorage.setItem(STORAGE_KEY_V2, json);
            localStorage.setItem(STORAGE_KEY_V1, json);
          } catch {}
          saveClientsToIndexedDB(data);
          return data;
        }
      }
    }
  } catch {}

  // Prova IndexedDB
  const idbData = await getClientsFromIndexedDB();
  if (idbData && idbData.length > 0 && !isObsoleteDemoList(idbData)) {
    try {
      const json = JSON.stringify(idbData);
      localStorage.setItem(STORAGE_KEY_V2, json);
      localStorage.setItem(STORAGE_KEY_V1, json);
    } catch {}
    return idbData;
  }

  return null;
}

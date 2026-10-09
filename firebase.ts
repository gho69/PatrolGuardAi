import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  getDocs,
  Unsubscribe 
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { ClientProfile } from './types';

// Inizializzazione Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

// Provider Google
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Test di connessione obbligatorio
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Verificare la configurazione Firebase: client offline.');
    }
    return false;
  }
}

// Chiamata immediata di validazione connessione al boot
testConnection();

// Tipizzazione Error Handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Autenticazione con Google Popup
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error('Errore autenticazione Google:', err);
    throw err;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Errore disconnessione:', err);
  }
}

// Sottoscrizione Real-time ai clienti dell'utente autenticato
export function subscribeUserClients(
  userId: string,
  onUpdate: (clients: ClientProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const clientsPath = `users/${userId}/clients`;
  const clientsCol = collection(db, 'users', userId, 'clients');

  return onSnapshot(
    clientsCol,
    (snapshot) => {
      const items: ClientProfile[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ClientProfile;
        if (data && data.id && data.name) {
          items.push(data);
        }
      });
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, clientsPath);
      if (onError) onError(error);
    }
  );
}

// Salvataggio di un singolo cliente su Firestore
export async function saveClientToFirestore(userId: string, client: ClientProfile): Promise<void> {
  const docPath = `users/${userId}/clients/${client.id}`;
  try {
    const docRef = doc(db, 'users', userId, 'clients', client.id);
    await setDoc(docRef, client, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

// Eliminazione di un cliente da Firestore
export async function deleteClientFromFirestore(userId: string, clientId: string): Promise<void> {
  const docPath = `users/${userId}/clients/${clientId}`;
  try {
    const docRef = doc(db, 'users', userId, 'clients', clientId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// Salvataggio dell'ID cliente attivo su Firestore
export async function saveActiveClientIdToFirestore(userId: string, activeId: string): Promise<void> {
  const userPath = `users/${userId}`;
  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, { activeClientId: activeId, email: auth.currentUser?.email || '' }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

// Sincronizzazione iniziale: popola con l'archivio esistente/default se Firestore è vuoto per questo utente
export async function seedInitialClientsIfEmpty(userId: string, initialList: ClientProfile[]): Promise<void> {
  const clientsPath = `users/${userId}/clients`;
  try {
    const clientsCol = collection(db, 'users', userId, 'clients');
    const snap = await getDocs(clientsCol);
    if (snap.empty && initialList.length > 0) {
      for (const c of initialList) {
        await saveClientToFirestore(userId, c);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, clientsPath);
  }
}

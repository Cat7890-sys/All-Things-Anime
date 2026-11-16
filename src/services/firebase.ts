import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import appletConfig from '../../firebase-applet-config.json';

interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

function resolveFirebaseConfig(): FirebaseWebConfig {
  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const envAppId = import.meta.env.VITE_FIREBASE_APP_ID;

  if (envApiKey && envAuthDomain && envProjectId && envAppId) {
    return {
      apiKey: envApiKey,
      authDomain: envAuthDomain,
      projectId: envProjectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId:
        import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: envAppId,
      firestoreDatabaseId:
        import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)',
    };
  }

  return {
    apiKey: appletConfig.apiKey,
    authDomain: appletConfig.authDomain,
    projectId: appletConfig.projectId,
    storageBucket: appletConfig.storageBucket,
    messagingSenderId: appletConfig.messagingSenderId,
    appId: appletConfig.appId,
    firestoreDatabaseId: appletConfig.firestoreDatabaseId,
  };
}

const resolvedConfig = resolveFirebaseConfig();

export const isFirebaseConfigured = Boolean(
  resolvedConfig.apiKey &&
    resolvedConfig.authDomain &&
    resolvedConfig.projectId &&
    resolvedConfig.appId
);

export const isStorageConfigured = Boolean(resolvedConfig.storageBucket);

export const firebaseProjectMeta = {
  projectId: resolvedConfig.projectId,
  firestoreDatabaseId: resolvedConfig.firestoreDatabaseId || '(default)',
  storageBucket: resolvedConfig.storageBucket || '',
} as const;

export const firebaseApp: FirebaseApp = initializeApp(resolvedConfig);
export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore = resolvedConfig.firestoreDatabaseId
  ? getFirestore(firebaseApp, resolvedConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);
export const storage: FirebaseStorage | null = resolvedConfig.storageBucket
  ? getStorage(firebaseApp)
  : null;

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
    providerInfo?: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testFirestoreConnection(): Promise<void> {
  if (connectionTested || !isFirebaseConfigured) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'publicProfiles', 'connection_check'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testFirestoreConnection();

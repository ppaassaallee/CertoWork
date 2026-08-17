import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const SAME_ORIGIN_AUTH_HOSTS = new Set([
  'certo.work',
  'www.certo.work',
  'certo-work.gazellehunt.workers.dev',
  'gazelle-boldr-ai.boldrai-3640.chatgpt.site',
]);

function resolveAuthDomain() {
  if (typeof window === 'undefined') return firebaseConfig.authDomain;
  return SAME_ORIGIN_AUTH_HOSTS.has(window.location.hostname)
    ? window.location.hostname
    : firebaseConfig.authDomain;
}

const runtimeFirebaseConfig = {
  ...firebaseConfig,
  // In production the Worker transparently serves Firebase's auth helper from
  // this same host. That keeps Safari/Firefox from treating the auth handshake
  // as third-party storage and returns the user to Certo Work, not firebaseapp.
  authDomain: resolveAuthDomain(),
};

const app = initializeApp(runtimeFirebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Firebase defaults to IndexedDB before falling back to localStorage. Safari and
// embedded browsers can leave IndexedDB initialization pending, which prevents
// onAuthStateChanged from ever resolving and strands the app on its splash
// screen. Certo Work only needs durable session persistence, so use the simpler
// localStorage-backed strategy explicitly.
let configuredAuth: Auth;
try {
  configuredAuth = initializeAuth(app, {
    persistence: browserLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch {
  // Vite hot reload can reuse an already initialized Firebase app.
  configuredAuth = getAuth(app);
}

export const auth = configuredAuth;

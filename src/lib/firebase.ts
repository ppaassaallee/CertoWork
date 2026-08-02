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

const PRODUCTION_SITE_HOST = 'gazelle-boldr-ai.boldrai-3640.chatgpt.site';
const runtimeFirebaseConfig = {
  ...firebaseConfig,
  // In production the Worker transparently serves Firebase's auth helper from
  // this same host. That keeps Safari/Firefox from treating the auth handshake
  // as third-party storage and returns the user to DelivereeOS, not firebaseapp.
  authDomain:
    typeof window !== 'undefined' && window.location.hostname === PRODUCTION_SITE_HOST
      ? PRODUCTION_SITE_HOST
      : firebaseConfig.authDomain,
};

const app = initializeApp(runtimeFirebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Firebase defaults to IndexedDB before falling back to localStorage. Safari and
// embedded browsers can leave IndexedDB initialization pending, which prevents
// onAuthStateChanged from ever resolving and strands the app on its splash
// screen. DelivereeOS only needs durable session persistence, so use the simpler
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

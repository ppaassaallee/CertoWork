import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { resolveFirebaseAuthDomain } from './authFlow';

// Production uses the current hostname as authDomain so Google returns to the
// same origin that stored the sign-in state. Cloudflare already proxies
// `/__/auth/*` to Firebase. Localhost keeps the Firebase-hosted domain because
// the Vite app does not serve that handler.
const app = initializeApp({
  ...firebaseConfig,
  authDomain: resolveFirebaseAuthDomain(firebaseConfig.authDomain),
});
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

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

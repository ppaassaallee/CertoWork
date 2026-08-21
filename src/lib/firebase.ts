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

// Keep the Firebase-hosted auth helper as the canonical Google OAuth redirect.
// Certo Work itself is served from Cloudflare, but Google sign-in must use a
// redirect URI registered on the Firebase-created OAuth client. Using the
// custom app domain here causes redirect_uri_mismatch unless the Firebase auth
// handler is also hosted and registered there.
const app = initializeApp(firebaseConfig);
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

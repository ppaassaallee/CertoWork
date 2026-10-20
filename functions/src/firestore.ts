import { getFirestore } from "firebase-admin/firestore";

// Certo's Firestore data lives in a named database, not (default).
export const CERTO_FIRESTORE_DATABASE = "ai-studio-0db18e51-58a2-4763-a4d7-3fced116347d";

export function getCertoFirestore() {
  return getFirestore(CERTO_FIRESTORE_DATABASE);
}

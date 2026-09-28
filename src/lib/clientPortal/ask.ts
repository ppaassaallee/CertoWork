import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase";

/** Scoped Odysseus ask — projected docs only (server-enforced). */
export async function portalAsk(input: {
  clientId: string;
  projectId: string;
  question: string;
}) {
  const fn = httpsCallable(getFunctions(app, "us-central1"), "portalAsk");
  const res = await fn(input);
  return res.data as { answer: string; citations: string[] };
}

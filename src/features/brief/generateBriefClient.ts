import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { buildTemplateBrief, hashInputs, validateBriefNumbers } from "./buildTemplateBrief";
import { gatherBriefInputs, type GatherBriefArgs } from "./gatherBriefInputs";
import type { Brief } from "./types";

export function briefDocId(uid: string, dateKey: string) {
  return `${uid}_${dateKey}`;
}

export async function loadBrief(uid: string, dateKey: string): Promise<Brief | null> {
  try {
    const snap = await getDoc(doc(db, "briefs", briefDocId(uid, dateKey)));
    if (!snap.exists()) return null;
    return snap.data() as Brief;
  } catch {
    return null;
  }
}

export async function generateBriefClient(opts: {
  uid: string;
  force?: boolean;
  gather: GatherBriefArgs;
  polishWithLlm?: (template: Brief, inputs: ReturnType<typeof gatherBriefInputs>) => Promise<Brief | null>;
}): Promise<Brief> {
  const inputs = gatherBriefInputs(opts.gather);
  const hash = hashInputs(inputs);
  if (!opts.force) {
    const existing = await loadBrief(opts.uid, inputs.dateKey);
    if (existing && existing.inputsHash === hash) return existing;
  }

  let brief = buildTemplateBrief(inputs, opts.uid);

  if (opts.polishWithLlm) {
    try {
      const polished = await opts.polishWithLlm(brief, inputs);
      if (polished && validateBriefNumbers(polished, inputs)) {
        brief = { ...polished, source: "llm", inputsHash: hash, uid: opts.uid };
      }
    } catch {
      /* keep template */
    }
  }

  try {
    await setDoc(
      doc(db, "briefs", briefDocId(opts.uid, inputs.dateKey)),
      { ...brief, generatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch {
    /* offline / rules — return in-memory */
  }

  return brief;
}

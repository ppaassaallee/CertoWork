import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { formatSemanticBlock, type SemanticBlockType } from "../../lib/semanticBlocks";
import { weekLabel, type RecipeManifest } from "../../lib/routines/manifest";
import type { RoutineSession } from "../../lib/routines/sessions";
import type { FindingAnswer } from "./cards/Finding";
import type { ReflectionAnswer } from "./cards/Reflection";
import type { TriageAnswer } from "./cards/ItemTriage";
import type { GoalComposerAnswer } from "./cards/GoalComposer";
import type { TimeBlocksAnswer } from "./cards/TimeBlocks";
import {
  closeDayPlan,
  localDateKey,
  type DayFeel,
  type EnergyTag,
} from "../../lib/dayplan";

async function ensureNotebook(
  workspaceId: string,
  userId: string,
  title: string,
): Promise<{ notebookId: string; sectionId: string }> {
  const existing = await getDocs(
    query(
      collection(db, "notebook_entries"),
      where("workspaceId", "==", workspaceId),
      where("userId", "==", userId),
      where("kind", "==", "notebook"),
      where("title", "==", title),
      limit(1),
    ),
  );
  if (!existing.empty) {
    const notebookId = existing.docs[0].id;
    const sections = await getDocs(
      query(
        collection(db, "notebook_entries"),
        where("notebookId", "==", notebookId),
        where("kind", "==", "section"),
        limit(1),
      ),
    );
    if (!sections.empty) {
      return { notebookId, sectionId: sections.docs[0].id };
    }
    const section = await addDoc(collection(db, "notebook_entries"), {
      kind: "section",
      title: "Inbox",
      notebookId,
      workspaceId,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { notebookId, sectionId: section.id };
  }

  const notebook = await addDoc(collection(db, "notebook_entries"), {
    kind: "notebook",
    title,
    workspaceId,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const section = await addDoc(collection(db, "notebook_entries"), {
    kind: "section",
    title: "Inbox",
    notebookId: notebook.id,
    workspaceId,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { notebookId: notebook.id, sectionId: section.id };
}

function blockText(
  answers: Record<string, unknown>,
  cardId: string,
): string {
  const raw = answers[cardId];
  if (!raw) return "";
  if (typeof raw === "object" && raw && "text" in (raw as object)) {
    return String((raw as ReflectionAnswer).text || "");
  }
  if (typeof raw === "object" && raw && "acceptedIds" in (raw as object)) {
    const finding = raw as FindingAnswer;
    return finding.items
      .filter((item) => finding.acceptedIds.includes(item.id))
      .map((item) => `- ${item.title}`)
      .join("\n");
  }
  if (typeof raw === "object" && raw && "goals" in (raw as object)) {
    const goals = raw as GoalComposerAnswer;
    return goals.goals
      .filter((g) => g.title.trim())
      .map(
        (g) =>
          `- ${g.title}\n${g.actions
            .filter((a) => a.title.trim())
            .map((a) => `  - ${a.title}`)
            .join("\n")}`,
      )
      .join("\n");
  }
  if (typeof raw === "object" && raw && "blocks" in (raw as object)) {
    const blocks = raw as TimeBlocksAnswer;
    return blocks.blocks
      .map((b) => `- ${b.day} ${b.start}–${b.end} ${b.label}`)
      .join("\n");
  }
  return String(raw);
}

export async function finishRitualSession(input: {
  session: RoutineSession;
  manifest: RecipeManifest;
  locale?: "es" | "en";
}): Promise<{ noteId: string; markdown: string; actions: unknown[] }> {
  const { session, manifest } = input;
  const locale = input.locale || "es";
  const answers = session.answers || {};
  const parts: string[] = [];

  if (manifest.id === "close-day") {
    const feel = answers["feel-choice"] as DayFeel | undefined;
    const energy = (answers["energy-tags"] as Record<string, EnergyTag> | undefined) ?? {};
    const carry = answers["carry-text"] as { text?: string } | string | undefined;
    const carryText = typeof carry === "string" ? carry : carry?.text ?? null;
    await closeDayPlan(session.userId, session.workspaceId, localDateKey(), {
      feel: feel ?? "normal",
      energy,
      carryForward: carryText,
    });
  }

  for (const step of manifest.steps) {
    if (!step.savesAs?.blockType) continue;
    const texts: string[] = [];
    for (const card of step.cards) {
      const text = blockText(answers, card.id);
      if (text.trim()) texts.push(text.trim());
    }
    if (!texts.length) continue;
    const type = step.savesAs.blockType as SemanticBlockType;
    parts.push(formatSemanticBlock(type, texts.join("\n\n")));
  }

  const markdown = parts.join("\n\n");
  const { notebookId, sectionId } = await ensureNotebook(
    session.workspaceId,
    session.userId,
    manifest.output.note.notebook,
  );
  const title = manifest.output.note.titleTemplate
    .replace("{weekLabel}", weekLabel(session.weekOf, locale))
    .replace("{date}", localDateKey());
  const noteRef = await addDoc(collection(db, "notebook_entries"), {
    kind: "note",
    title,
    content: markdown,
    notebookId,
    sectionId,
    workspaceId: session.workspaceId,
    userId: session.userId,
    ritualSessionId: session.id,
    recipeId: session.recipeId,
    weekOf: session.weekOf,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const actions: unknown[] = [];
  const triage = answers["undone-triage"] as TriageAnswer | undefined;
  if (triage?.decisions) {
    for (const [itemId, decision] of Object.entries(triage.decisions)) {
      actions.push({ type: "triage", itemId, decision });
    }
  }
  const alignment = answers.alignment as ReflectionAnswer | undefined;
  if (alignment?.direction?.trim()) {
    actions.push({ type: "remember_fact", fact: alignment.direction.trim(), key: "direction" });
  }
  const goals = answers.goals as GoalComposerAnswer | undefined;
  if (goals?.goals) {
    for (const goal of goals.goals) {
      for (const action of goal.actions) {
        if (action.title.trim() && action.isNew) {
          actions.push({
            type: "create_item",
            title: action.title.trim(),
            goalTitle: goal.title,
            weekOf: session.weekOf,
          });
        }
      }
    }
  }
  const blocks = answers.blocks as TimeBlocksAnswer | undefined;
  if (blocks?.blocks?.length) {
    actions.push({ type: "store_blocks", blocks: blocks.blocks, dayOff: blocks.dayOff });
  }

  return { noteId: noteRef.id, markdown, actions };
}

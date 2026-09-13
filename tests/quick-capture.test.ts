import assert from "node:assert/strict";
import test from "node:test";
import {
  clipboardToCaptureDraft,
  compileItemSentence,
} from "../src/features/capture/compileItemSentence.ts";
import {
  parseCaptureTitle,
  parseNaturalDate,
} from "../src/features/capture/parseCaptureTitle.ts";

test("parseCaptureTitle extracts type person priority and date", () => {
  const now = new Date("2026-09-13T12:00:00Z");
  const members = [
    {
      id: "m1",
      alias: "César",
      displayName: "César",
      status: "active",
      userId: "u1",
    },
  ];
  const parsed = parseCaptureTitle(
    "Corregir el timeout #bug @César mañana !alta",
    members as any,
    now,
  );
  assert.equal(parsed.workItemType, "bug");
  assert.equal(parsed.priority, "2");
  assert.equal(parsed.dueDate, "2026-09-14");
  assert.equal(parsed.assigneeMemberId, "m1");
  assert.equal(parsed.cleanTitle, "Corregir el timeout");
  assert.ok(parsed.tokens.some((token) => token.kind === "type"));
});

test("parseNaturalDate handles en 3 dias", () => {
  const now = new Date("2026-09-13T12:00:00Z");
  assert.equal(parseNaturalDate("hoy", now), "2026-09-13");
  assert.equal(parseNaturalDate("en 3 dias", now), "2026-09-16");
});

test("compileItemSentence builds typed blocks and mirrors acceptance", () => {
  const result = compileItemSentence({
    title: "Login CHAMAN",
    body: "Objetivo: Cerrar el timeout\n- Debe autenticar\n- Debe reintentar",
  });
  assert.equal(result.title, "Login CHAMAN");
  assert.ok(result.blocks.some((block) => block.type === "objetivo"));
  assert.match(result.description, /:::objetivo/);
});

test("clipboard list proposes multiple roots", () => {
  const draft = clipboardToCaptureDraft("Uno\nDos\nTres\nCuatro");
  assert.equal(draft.mode, "list");
  assert.ok(draft.nodes.length >= 3);
});

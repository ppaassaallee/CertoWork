import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("auth bootstrap opens workspace before invite waterfall", () => {
  const source = readFileSync(
    new URL("../src/lib/AuthContext.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Promise\.allSettled\(\[/);
  assert.match(source, /openedEarly/);
  assert.match(source, /acceptEmailAndPendingInvites/);
  assert.match(source, /options\?\.reload !== false/);
});

test("workspace data listeners use a stable access key", () => {
  const source = readFileSync(
    new URL("../src/components/DelivereeWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /dataAccessKey/);
  assert.match(source, /\[dataAccessKey\]/);
  assert.match(source, /Warm Chat Collab only when the user opens Collab/);
  assert.match(source, /do not re-run Auth bootstrap/);
  assert.match(source, /setWorkspace\(pureAi, \{ reload: false \}\)/);
});

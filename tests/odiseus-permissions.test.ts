import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("firestore rules allow Odysseus run and activity collections", () => {
  const rules = readFileSync(resolve("firestore.rules"), "utf8");
  assert.match(rules, /match \/odiseus_runs\/\{id\}/);
  assert.match(rules, /match \/odiseus_activity\/\{id\}/);
  assert.match(
    rules,
    /function canAccessBoldiRecord\(data\)[\s\S]*?isWorkspaceOwner\(data\.workspaceId\)/,
  );
});

test("chat persistence does not hard-fail on Odysseus run writes", () => {
  const source = readFileSync(
    resolve("src/components/DelivereeWorkspace.tsx"),
    "utf8",
  );
  assert.match(source, /persistOdysseusRun\(/);
  assert.match(source, /recordOdysseusActivitySafe\(/);
  assert.doesNotMatch(
    source,
    /await addDoc\(collection\(db, "odiseus_runs"\)/,
  );
});

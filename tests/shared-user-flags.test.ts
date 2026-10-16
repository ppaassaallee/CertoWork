import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSharedFlagStore, type UserFeatureFlags } from "../src/features/flags/sharedFlagStore";

test("feature flags share one document listener and release it after the last consumer", () => {
  const publishes = new Map<string, (flags: UserFeatureFlags) => void>();
  const opened: string[] = [];
  const closed: string[] = [];
  const store = createSharedFlagStore((uid, publish) => {
    opened.push(uid);
    publishes.set(uid, publish);
    return () => {
      closed.push(uid);
      publishes.delete(uid);
    };
  });
  let firstUpdates = 0;
  let secondUpdates = 0;
  const stopFirst = store.subscribe("user-a", () => firstUpdates++);
  const stopSecond = store.subscribe("user-a", () => secondUpdates++);

  assert.deepEqual(opened, ["user-a"]);
  publishes.get("user-a")?.({ tables: true, dailyPlan: false });
  assert.equal(store.getSnapshot("user-a").tables, true);
  assert.equal(firstUpdates, 1);
  assert.equal(secondUpdates, 1);

  // Identical snapshots should not cause every mounted feature to rerender.
  publishes.get("user-a")?.({ tables: true, dailyPlan: false });
  assert.equal(firstUpdates, 1);
  stopFirst();
  assert.deepEqual(closed, []);
  stopSecond();
  assert.deepEqual(closed, ["user-a"]);
  assert.deepEqual(store.getSnapshot("user-a"), {});
});

test("feature flag snapshots stay isolated when the signed-in user changes", () => {
  const publishes = new Map<string, (flags: UserFeatureFlags) => void>();
  const store = createSharedFlagStore((uid, publish) => {
    publishes.set(uid, publish);
    return () => publishes.delete(uid);
  });
  const stopA = store.subscribe("user-a", () => {});
  const stopB = store.subscribe("user-b", () => {});
  publishes.get("user-a")?.({ billing: true });

  assert.equal(store.getSnapshot("user-a").billing, true);
  assert.equal(store.getSnapshot("user-b").billing, undefined);
  stopA();
  stopB();
});

test("workspace roster is listened to by the shared data store, not twice by the shell", () => {
  const shell = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const core = readFileSync(resolve("src/data/startWorkspaceData.ts"), "utf8");
  assert.match(shell, /const workspaceMembers = useMembers\(\)/);
  assert.doesNotMatch(shell, /collection\(db, "workspace_members"\)/);
  assert.match(core, /collection\(db, "workspace_members"\)/);
});

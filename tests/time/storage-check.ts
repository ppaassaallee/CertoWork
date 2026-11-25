import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator, terminate } from "firebase/firestore";
import { timeStore } from "../../src/lib/time/storage";
import { civilDate, weekDates } from "../../src/features/time/model";
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8097");
const app = initializeApp({ projectId: "demo-certo-time" }, "time-storage-check");
const database = getFirestore(app);
connectFirestoreEmulator(database, "127.0.0.1", 8097, {
  mockUserToken: {
    sub: "member",
    email: "member@example.com",
    email_verified: true,
  },
});
const store = timeStore("w", "member", database);
const base = {
  workspaceId: "w",
  userId: "member",
  sheetId: "default",
  projectId: "p",
  itemId: "public",
  description: "Timer integration check",
  date: civilDate(),
  billable: false,
};
try {
  const running = await store.timer();
  if (running) await store.discardTimer();
  const started = await Promise.allSettled([store.start(base), store.start(base)]);
  assert.equal(
    started.filter((result) => result.status === "fulfilled").length,
    1,
    "exactly one concurrent timer can start",
  );
  assert.ok(await store.timer());
  const stopped = await Promise.all([store.stop(), store.stop()]);
  assert.equal(stopped.filter(Boolean).length, 1, "two stops create one entry");
  assert.equal(await store.timer(), null);
  const dates = weekDates(civilDate());
  const page = await store.loadWeek(dates[0], dates[6]);
  const created = page.rows.filter((row) => row.description === base.description);
  assert.ok(created.length >= 1);
  assert.equal(created[created.length - 1].minutes, 1);
  const id = await store.addSheet("Integration sheet");
  assert.ok((await store.sheets()).some((row) => row.id === id));
  await store.save({
    ...base,
    id: "stable-retry-key",
    minutes: 30,
    sheetId: id,
  });
  await store.save({
    ...base,
    id: "stable-retry-key",
    minutes: 60,
    sheetId: id,
  });
  const reloaded = await store.loadWeek(dates[0], dates[6]);
  assert.equal(reloaded.rows.filter((row) => row.id === "stable-retry-key").length, 1);
  assert.equal(reloaded.rows.find((row) => row.id === "stable-retry-key")?.minutes, 60);
  await store.remove("stable-retry-key");
  const bulk = Array.from({ length: 50 }, (_, index) => ({
    ...base,
    id: `batch-check-${index}`,
    minutes: 15,
  }));
  await store.saveMany(bulk);
  await store.saveMany(bulk);
  const afterBulk = await store.loadWeek(dates[0], dates[6]);
  assert.equal(
    afterBulk.rows.filter((row) => row.id.startsWith("batch-check-")).length,
    50,
    "atomic paste is retry-safe",
  );
  await assert.rejects(store.saveMany([...bulk.slice(0, 2), { ...bulk[2], itemId: "private" }]));
  console.log(
    "PASS: real Firebase SDK + rules: concurrent start, atomic double stop, persisted timer, week query, custom sheet, idempotent edits and deletion",
  );
} finally {
  await terminate(database);
  await deleteApp(app);
}

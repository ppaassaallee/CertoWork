import assert from "node:assert/strict";
import test from "node:test";
import { createCompleteSnapshotMerge, hasConfirmedSnapshotData } from "../src/lib/firestoreSnapshotSafety";

test("an empty cache is not mistaken for confirmed deletion", () => {
  assert.equal(hasConfirmedSnapshotData({ empty: true, metadata: { fromCache: true, hasPendingWrites: false } }), false);
  assert.equal(hasConfirmedSnapshotData({ empty: true, metadata: { fromCache: false, hasPendingWrites: false } }), true);
  assert.equal(hasConfirmedSnapshotData({ empty: true, metadata: { fromCache: true, hasPendingWrites: true } }), true);
});

test("merged listeners wait for every query and retain the last complete result after an error", () => {
  const published: Array<Array<{ id: string }>> = [];
  const merge = createCompleteSnapshotMerge<{ id: string }>(2, (items) => published.push(items));
  merge.update(0, [{ id: "first" }]);
  assert.equal(published.length, 0);
  merge.update(1, [{ id: "second" }]);
  assert.deepEqual(published.at(-1)?.map((item) => item.id), ["first", "second"]);
  merge.fail(1);
  merge.update(0, []);
  assert.deepEqual(published.at(-1)?.map((item) => item.id), ["first", "second"]);
});

test("a failed first query still allows available records to render", () => {
  const published: Array<Array<{ id: string }>> = [];
  const merge = createCompleteSnapshotMerge<{ id: string }>(2, (items) => published.push(items));
  merge.update(0, [{ id: "available" }]);
  merge.fail(1);
  assert.deepEqual(published.at(-1)?.map((item) => item.id), ["available"]);
});

test("failed queries alone never publish an empty list", () => {
  const published: Array<Array<{ id: string }>> = [];
  const merge = createCompleteSnapshotMerge<{ id: string }>(2, (items) => published.push(items));
  merge.fail(0);
  merge.fail(1);
  assert.deepEqual(published, []);
});

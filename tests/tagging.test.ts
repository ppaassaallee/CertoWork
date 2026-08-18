import assert from "node:assert/strict";
import test from "node:test";

import { controlledOptions } from "../src/lib/controlledLists";
import { matchesTag, tagIds, tagLabels, toggleTagId } from "../src/lib/tagging";

test("tag helpers support current and legacy tag fields", () => {
  assert.deepEqual(tagIds({ tagIds: ["urgent", "client"] }), [
    "urgent",
    "client",
  ]);
  assert.deepEqual(tagIds({ tags: ["legacy"] }), ["legacy"]);
  assert.deepEqual(tagIds({ labels: ["old-label"] }), ["old-label"]);
});

test("tag helpers label and toggle tags without duplicates", () => {
  const tags = [
    { id: "urgent", name: "Urgent" },
    { id: "finance", name: "Finance" },
  ];
  const record = { tagIds: ["urgent"] };

  assert.equal(matchesTag(record, "urgent"), true);
  assert.equal(matchesTag(record, "finance"), false);
  assert.deepEqual(tagLabels(record, tags), ["Urgent"]);
  assert.deepEqual(toggleTagId(record, "finance").tagIds, [
    "urgent",
    "finance",
  ]);
  assert.deepEqual(toggleTagId(record, "urgent").tagIds, []);
});

test("tag labels never expose raw Firestore ids when a readable label exists", () => {
  const tags = [{ id: "rFCg1CMv6hv6t7XG2Wr7", name: "Product" }];
  assert.deepEqual(
    tagLabels({ tagIds: ["rFCg1CMv6hv6t7XG2Wr7"] }, tags),
    ["Product"],
  );
  assert.deepEqual(
    tagLabels({ tagIds: ["unknownFirestoreLikeId123"] }, tags),
    ["Unresolved tag"],
  );
});

test("controlled tag lists do not duplicate discovered ids for existing masters", () => {
  const options = controlledOptions(
    [{ id: "rFCg1CMv6hv6t7XG2Wr7", name: "Product", group: "tag" }],
    "tag",
    ["rFCg1CMv6hv6t7XG2Wr7"],
  );
  assert.deepEqual(options.map((option) => option.name), ["Product"]);
});

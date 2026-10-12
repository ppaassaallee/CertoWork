import assert from "node:assert/strict";
import test from "node:test";

import {
  orderPaletteItems,
  rememberRecentItem,
  workItemKeywords,
} from "../src/lib/commandSearch";

test("work item search text includes title, id, tag, client, and notes", () => {
  const text = workItemKeywords({
    id: "task_123",
    title: "Renew the lease",
    key: "ACME-14",
    description: "Call the broker",
    client: "Northwind",
    tags: ["legal"],
  }).toLowerCase();
  for (const part of ["renew the lease", "task_123", "acme-14", "broker", "northwind", "legal"]) {
    assert.equal(text.includes(part), true, part);
  }
});

test("recent items stay first after navigation when the query is empty", () => {
  const items = [
    { group: "Navigate", id: "home" },
    { group: "Projects", id: "p1" },
    { group: "Recent", id: "recent-1", recentOnly: true },
  ];
  assert.deepEqual(
    orderPaletteItems(items, "").map((item) => item.id),
    ["home", "recent-1", "p1"],
  );
  assert.deepEqual(
    orderPaletteItems(items, "lease").map((item) => item.id),
    ["home", "p1"],
  );
});

test("remembering an item keeps it at the front and drops duplicates", () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
  };
  rememberRecentItem("a", storage);
  rememberRecentItem("b", storage);
  const next = rememberRecentItem("a", storage);
  assert.deepEqual(next, ["a", "b"]);
});

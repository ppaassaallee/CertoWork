import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp } from "firebase/firestore";
import { formatDate, formatDateFull, formatDateRelative } from "../src/shared/formatDate";

test("formatDate handles Date, seconds map, and Timestamp", () => {
  assert.equal(formatDate(new Date("2025-09-20T12:00:00Z")).includes("Sep"), true);
  assert.equal(formatDate({ seconds: 1758384000 }).length > 0, true);
  assert.equal(formatDate(Timestamp.fromDate(new Date("2025-09-20T12:00:00Z"))).includes("Sep"), true);
});

test("formatDate never returns Timestamp( for objects", () => {
  const raw = formatDate({ seconds: 1758384000, nanoseconds: 0 });
  assert.equal(raw.includes("Timestamp"), false);
  assert.equal(String(raw).includes("[object"), false);
});

test("formatDateFull and relative", () => {
  assert.equal(formatDateFull(new Date("2025-09-20T12:00:00Z")).includes("2025"), true);
  assert.equal(formatDateRelative(Date.now() - 1000), "just now");
});

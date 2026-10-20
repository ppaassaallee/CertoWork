import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getLocale, setLocale } from "../src/lib/i18n";
import { workStatusLabel } from "../src/lib/workStatuses";

const items = readFileSync(new URL("../src/components/WorkItemsCenter.tsx", import.meta.url), "utf8");
const chrome = readFileSync(new URL("../src/features/projects/chrome/ProjectPageChrome.tsx", import.meta.url), "utf8");

test("project rows have one date control with today and week in its menu", () => {
  assert.doesNotMatch(items, /renderTimingButtons/);
  assert.match(items, /id: "today", label: tr\("Today", "Hoy"\)/);
  assert.match(items, /id: "week", label: tr\("This week", "Esta semana"\)/);
  assert.match(items, /openPinnedAttr\(item, "due", event\)/);
  assert.match(items, /gridTemplateColumns: isMyWork[\s\S]*?"20px 20px 28px minmax\(160px, 1fr\) auto 28px"/);
});

test("project chrome and item surface subscribe to language changes", () => {
  assert.match(items, /const locale = useLocale\(\)/);
  assert.match(chrome, /const locale = useLocale\(\)/);
  assert.match(chrome, /localize\(locale, "Progress", "Progreso"\)/);
});

test("status labels switch with the language, while status keys stay stable", () => {
  const previous = getLocale();
  try {
    setLocale("es");
    assert.equal(workStatusLabel("in_progress"), "En curso");
    setLocale("en");
    assert.equal(workStatusLabel("in_progress"), "Doing");
  } finally {
    setLocale(previous);
  }
});

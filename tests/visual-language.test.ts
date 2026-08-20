import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { CERTO_TEXT_SIZE_OPTIONS, normalizeCertoTextSize } from "../src/lib/textSize";
import { compactTagSummary } from "../src/components/CompactTagPicker";

const read = (relativePath: string) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("live typography exposes one semantic hierarchy", async () => {
  const css = await read("src/index.css");
  assert.match(css, /--font-body: "DM Sans"/);
  assert.match(css, /--font-display: "Manrope"/);
  assert.match(css, /--text-h1: calc\(24px/);
  assert.match(css, /--text-h2: calc\(20px/);
  assert.match(css, /--text-h3: calc\(16px/);
  assert.match(css, /--text-h4: calc\(14px/);
  assert.match(css, /--text-body: calc\(14px/);
  assert.match(css, /--text-ui: calc\(13px/);
  assert.match(css, /--text-caption: calc\(12px/);
  assert.equal(css.includes("Inter, sans-serif"), false);
  assert.match(css, /font-size: var\(--text-ui\) !important/);
  assert.match(css, /font-size: var\(--text-caption\) !important/);
});

test("all five text sizes survive startup and use one language", async () => {
  const html = await read("index.html");
  for (const value of ["1", "2", "3", "4", "5"]) {
    assert.match(html, new RegExp(`size === "${value}"`));
    assert.equal(normalizeCertoTextSize(value), value);
  }
  assert.deepEqual(
    CERTO_TEXT_SIZE_OPTIONS.map((option) => option.label),
    ["Compact", "Default", "Comfortable", "Large", "Extra large"],
  );
});

test("persistent utility buttons are icon-only and accessibly named", async () => {
  const source = await read("src/components/DelivereeWorkspace.tsx");
  const header = source.split('<div className="do-header-actions">')[1]?.split("</div>")[0] || "";
  assert.match(header, /is-icon-only/);
  assert.match(header, /aria-label="Skills"/);
  assert.match(header, /aria-label="Digest"/);
  assert.match(header, /aria-label="Today"/);
  assert.match(header, /aria-label="Pending changes"/);
  assert.equal(header.includes("<span>Skills</span>"), false);
});

test("primary navigation uses consistent English labels", async () => {
  const source = await read("src/components/DelivereeWorkspace.tsx");
  assert.match(source, /> Conversation/);
  assert.match(source, /> Items/);
  assert.match(source, /> Notes/);
  assert.equal(/Conversación|Ítems|Notas|Pendientes/.test(source), false);
});

test("tag controls collapse multiple values to a no-wrap count", async () => {
  const css = await read("src/index.css");
  assert.equal(compactTagSummary([]), "No tags");
  assert.equal(compactTagSummary(["AI"]), "AI");
  assert.equal(compactTagSummary(["AI", "Client", "Urgent"]), "3 tags");
  assert.match(css, /\.do-tag-picker select[\s\S]*white-space: nowrap/);
  assert.match(css, /\.do-tag-picker select[\s\S]*text-overflow: ellipsis/);
});

test("project Team uses the dense caption tier", async () => {
  const css = await read("src/index.css");
  assert.match(css, /\.do-team-table select[\s\S]*height: 30px/);
  assert.match(css, /\.do-team-table,[\s\S]*font-size: var\(--text-caption\) !important/);
});

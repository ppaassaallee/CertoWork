import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { CERTO_TEXT_SIZE_OPTIONS, normalizeCertoTextSize } from "../src/lib/textSize";

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

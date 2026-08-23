import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { CERTO_TEXT_SIZE_OPTIONS, normalizeCertoTextSize } from "../src/lib/textSize";
import { compactTagSummary } from "../src/components/CompactTagPicker";

const read = (relativePath: string) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("live typography exposes the Notion five-token hierarchy", async () => {
  const tokens = await read("src/styles/certo-tokens.css");
  const css = await read("src/index.css");
  assert.match(tokens, /--font-body: "Inter"/);
  assert.match(tokens, /--text-primary: #37352f/);
  assert.match(tokens, /--accent: #2383e2/);
  assert.match(tokens, /--text-h2: calc\(1\.75rem/);
  assert.match(tokens, /--text-h4: calc\(1\.125rem/);
  assert.match(tokens, /--text-body: calc\(0\.875rem/);
  assert.match(tokens, /--text-body-sm: calc\(0\.8125rem/);
  assert.match(tokens, /--text-caption: calc\(0\.75rem/);
  assert.match(css, /certo-tokens\.css/);
  assert.equal(css.includes("Manrope"), false);
  assert.equal(css.includes("DM Sans"), false);
  assert.equal(/font-size:\s*var\(--text-(?:h1|h3|body-lg|eyebrow|ui)\)/.test(css), false);
  assert.match(css, /font-size: var\(--text-body-sm\) !important/);
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

test("header keeps command palette and create utilities", async () => {
  const source = await read("src/components/DelivereeWorkspace.tsx");
  const header = source.split('<header className="do-header">')[1]?.split("</header>")[0] || "";
  assert.match(header, /command palette|Command palette/i);
  assert.match(header, /headerCreate|Create/);
  assert.equal(header.includes('aria-label="Skills"'), false);
  assert.equal(header.includes('aria-label="Digest"'), false);
  assert.equal(header.includes('aria-label="Today"'), false);
  assert.equal(header.includes('aria-label="Pending changes"'), false);
});

test("primary navigation uses consistent English labels", async () => {
  const source = await read("src/components/DelivereeWorkspace.tsx");
  assert.match(source, /navHome|Home/);
  assert.match(source, /navMyWork|My Work/);
  assert.match(source, /navProjects|Projects/);
  assert.match(source, /navAgents|Agents/);
  assert.match(source, /navApprovals|Approvals/);
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

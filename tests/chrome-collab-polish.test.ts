import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("header shows breadcrumbs and keeps a single filled primary CTA", () => {
  const workspace = readFileSync(
    resolve("src/components/DelivereeWorkspace.tsx"),
    "utf8",
  );
  const css = readFileSync(resolve("src/index.css"), "utf8");
  const header =
    workspace.split('<header className="do-header">')[1]?.split("</header>")[0] ||
    "";

  assert.match(header, /do-breadcrumb-path/);
  assert.match(header, /AppBreadcrumbs/);
  assert.match(header, /header-odysseus/);
  assert.match(header, /cw-btn-primary/);
  assert.match(header, /command palette|Command palette/i);

  // Odysseus is ghost/outline — not a filled accent pill competing with Create.
  assert.match(css, /\.do-ody-btn \{[\s\S]*background:\s*transparent/);
  assert.match(css, /\.do-breadcrumb-path \{[\s\S]*display:\s*flex/);
  assert.match(css, /\.do-breadcrumb-compact \{[\s\S]*display:\s*none/);
});

test("collab desk uses wash columns and a quiet New control", () => {
  const list = readFileSync(
    resolve("src/features/collab/ConversationList.tsx"),
    "utf8",
  );
  const css = readFileSync(resolve("src/index.css"), "utf8");

  assert.match(list, /do-collab-btn-secondary do-collab-new-btn/);
  assert.doesNotMatch(list, /do-collab-btn-primary do-collab-new-btn/);
  assert.match(css, /\.do-collab-list \{[\s\S]*background:\s*var\(--collab-wash\)/);
  assert.match(css, /\.do-collab-context \{[\s\S]*background:\s*var\(--collab-wash\)/);
  assert.match(css, /\.do-collab-filters \{[\s\S]*flex-wrap:\s*nowrap/);
});

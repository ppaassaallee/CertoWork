import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { htmlToMarkdown, markdownToHtml, plainNoteText } from "../src/lib/noteMarkup";

test("markdown becomes HTML with visible heading sizes and inline styles", () => {
  const html = markdownToHtml("# Title\n## Section\n**90-120 day** close *three* `code` ~~old~~\n- Item");
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<h2>Section<\/h2>/);
  assert.match(html, /<strong>90-120 day<\/strong>/);
  assert.match(html, /<em>three<\/em>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<s>old<\/s>/);
  assert.match(html, /<li>Item<\/li>/);
});

test("HTML from the rich editor round-trips back to markdown", () => {
  const source = [
    "# BOLDR DEMAND ACCELERATION",
    "## Commercial objective",
    "**90-120 day objective:** close the first **3 referenceable customers**.",
    "### Focus A — United States",
    "- First account",
  ].join("\n");
  const roundTrip = htmlToMarkdown(markdownToHtml(source));
  assert.match(roundTrip, /^# BOLDR DEMAND ACCELERATION/m);
  assert.match(roundTrip, /^## Commercial objective/m);
  assert.match(roundTrip, /\*\*90-120 day objective:\*\*/);
  assert.match(roundTrip, /^### Focus A — United States/m);
  assert.match(roundTrip, /^- First account/m);
  assert.equal(plainNoteText(roundTrip).includes("90-120 day objective"), true);
});

test("contenteditable Chrome markup converts to markdown", () => {
  const html = "<div><b>Hello</b> <i>there</i></div><div>Next line</div>";
  const markdown = htmlToMarkdown(html);
  assert.match(markdown, /\*\*Hello\*\*/);
  assert.match(markdown, /\*there\*/);
  assert.match(markdown, /Next line/);
});

test("notebook UI uses one formatted editor instead of split markdown preview", () => {
  const notes = readFileSync(resolve("src/components/NotesWorkspace.tsx"), "utf8");
  assert.match(notes, /NoteRichEditor/);
  assert.doesNotMatch(notes, /do-notes-preview/);
  assert.doesNotMatch(notes, /wrapSelection/);
  const editor = readFileSync(resolve("src/components/NoteRichEditor.tsx"), "utf8");
  assert.match(editor, /contentEditable/);
  assert.match(editor, /formatBlock/);
  assert.match(editor, /insertUnorderedList/);
});

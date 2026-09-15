import test from "node:test";
import assert from "node:assert/strict";
import { htmlToMarkdown, markdownToHtml } from "../src/lib/noteMarkup";

test("entity links round-trip item, person, and record chips", () => {
  const md = "See [#RPA-70-14](item:abc123) with [@César](person:u9) and [#Brevo](record:rec9).";
  const html = markdownToHtml(md);
  assert.match(html, /cw-notes-ent-task/);
  assert.match(html, /cw-notes-ent-person/);
  assert.match(html, /cw-notes-ent-record/);
  assert.match(html, /data-ent-id="abc123"/);
  assert.match(html, /data-ent-id="u9"/);
  assert.match(html, /data-ent-id="rec9"/);
  const back = htmlToMarkdown(html);
  assert.match(back, /\[#RPA-70-14\]\(item:abc123\)/);
  assert.match(back, /\[@César\]\(person:u9\)/);
  assert.match(back, /\[#Brevo\]\(record:rec9\)/);
});

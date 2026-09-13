import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSemanticBlock,
  getBlocks,
  hasAcceptanceCriteria,
  insertBlockIntoMarkdown,
} from "../src/lib/semanticBlocks.ts";
import { htmlToMarkdown, markdownToHtml } from "../src/lib/noteMarkup.tsx";

test("getBlocks reads fence blocks and mirrors acceptanceCriteria", () => {
  const md = `${formatSemanticBlock("objetivo", "Cerrar piloto")}\n\nextra`;
  const blocks = getBlocks(md);
  assert.equal(blocks[0].type, "objetivo");
  assert.equal(blocks[0].text, "Cerrar piloto");

  const withLegacy = {
    description: "plain",
    acceptanceCriteria: "Propuesta enviada",
  };
  assert.ok(hasAcceptanceCriteria(withLegacy));
  assert.ok(
    getBlocks(withLegacy).some((block) => block.type === "criterios_aceptacion"),
  );
});

test("semantic fences round-trip through markdown HTML", () => {
  const md = insertBlockIntoMarkdown(
    "Intro",
    "criterios_aceptacion",
    "Al menos 3 cotizaciones",
  );
  const html = markdownToHtml(md);
  assert.match(html, /cw-sem-block/);
  assert.match(html, /data-block="criterios_aceptacion"/);
  const back = htmlToMarkdown(html);
  assert.match(back, /:::criterios_aceptacion/);
  assert.match(back, /Al menos 3 cotizaciones/);
});

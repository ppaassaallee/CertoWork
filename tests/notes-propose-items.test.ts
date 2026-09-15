import test from "node:test";
import assert from "node:assert/strict";
import {
  proposeItemsFromNote,
  upsertProximosPasosBlock,
} from "../src/lib/notes/proposeItems";

test("proposeItemsFromNote reads proximos_pasos lines", () => {
  const md = `:::objetivo
**Objetivo**
Kickoff
:::

:::proximos_pasos
**Próximos pasos**
- Enviar agenda
- Confirmar asistentes
- Bloquear sala
:::`;
  const items = proposeItemsFromNote(md);
  assert.equal(items.length, 3);
  assert.equal(items[0].title, "Enviar agenda");
});

test("upsertProximosPasosBlock appends chips", () => {
  const next = upsertProximosPasosBlock("Hola", ["[#A](item:1)", "[#B](item:2)"]);
  assert.match(next, /:::proximos_pasos/);
  assert.match(next, /\[#A\]\(item:1\)/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const component = readFileSync(new URL("../src/features/relationships/RelationshipMap.tsx", import.meta.url), "utf8");
test("mind map scroll viewport can shrink inside the fixed app shell", () => {
  const section = css.slice(css.indexOf(".cw-relationships {"), css.indexOf(".cw-relationships-header {"));
  assert.match(section, /flex: 1 1 0/);
  assert.match(section, /min-height: 0/);
  assert.doesNotMatch(section, /100vh/);
  const scroll = css.slice(css.indexOf(".cw-map-scroll {"), css.indexOf(".cw-map-scroll.is-panning"));
  assert.match(scroll, /overflow: scroll/);
  assert.match(scroll, /min-height: 0/);
  assert.doesNotMatch(scroll, /588px|520px/);
  assert.match(css, /\.cw-map-scene \{ width: max-content/);
});
test("canvas exposes keyboard scrolling, pointer panning and a bilingual reset", () => {
  assert.match(component, /tabIndex=\{0\} role="region"/);
  assert.match(component, /setPointerCapture/);
  assert.match(component, /onLostPointerCapture/);
  assert.match(component, /pointerType !== "mouse"/);
  assert.match(component, /Back to start", "Volver al inicio/);
});

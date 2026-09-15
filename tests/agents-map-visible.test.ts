import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAgentsMapEnabled } from "../src/features/agentsMap/agentsMapFlag";

test("agents map is on by default so Rutinas shows the live diagram", () => {
  assert.equal(isAgentsMapEnabled(), true);
  const flag = readFileSync(resolve("src/features/agentsMap/agentsMapFlag.ts"), "utf8");
  assert.match(flag, /shipped on by default/i);
  assert.doesNotMatch(flag, /return Boolean\(env\?\.DEV\)/);
});

test("Rutinas shell mounts AgentsArea on the map tab with flow copy", () => {
  const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
  const area = readFileSync(resolve("src/features/agentsMap/AgentsArea.tsx"), "utf8");
  const example = readFileSync(resolve(".env.example"), "utf8");
  assert.match(workspace, /centerView === "routines"/);
  assert.match(workspace, /areaTitle="Rutinas"/);
  assert.match(workspace, /initialTab="map"/);
  assert.match(workspace, /Mapa de flujos/);
  assert.match(area, /Disparadores → Rutinas → Agentes → Salidas/);
  assert.match(area, /agents-area-tab-map/);
  assert.match(example, /VITE_AGENTS_MAP_ENABLED=1/);
});

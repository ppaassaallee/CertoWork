import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAgentsMapEnabled } from "../src/features/agentsMap/agentsMapFlag";

test("agents network map is off by default and linked from Analítica", () => {
  assert.equal(isAgentsMapEnabled(), false);
  const flag = readFileSync(resolve("src/features/agentsMap/agentsMapFlag.ts"), "utf8");
  const area = readFileSync(resolve("src/features/agentsMap/AgentsArea.tsx"), "utf8");
  const example = readFileSync(resolve(".env.example"), "utf8");
  assert.match(flag, /Default OFF/i);
  assert.match(area, /Red de agentes/);
  assert.match(example, /VITE_AGENTS_MAP_ENABLED=0/);
});

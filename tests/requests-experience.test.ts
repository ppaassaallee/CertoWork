import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("client help desk exposes the three request kinds and keeps preview read-only", () => {
  const page = source("../src/portal/pages/Requests.tsx");
  assert.match(page, /data-testid="client-service-desk"/);
  for (const kind of ["request", "incident", "feedback"]) {
    assert.match(page, new RegExp(`kind: "${kind}"`));
  }
  assert.match(page, /disabled=\{preview \|\| busy/);
  assert.match(source("../src/portal/PortalApp.tsx"), /<PortalRequestsPage preview \/>/);
});

test("operator navigation stays outside the header and project team reuses loaded tickets", () => {
  const operator = source("../src/components/RequestsCenter.tsx");
  const styles = source("../src/index.css");
  const team = source("../src/features/clientPortal/ClientPortalTab.tsx");
  assert.match(operator, /<\/header>\s*<nav className="do-requests-tabs"/);
  assert.match(styles, /\.do-requests > \.do-requests-tabs \{ display: flex;/);
  assert.match(team, /tickets = \[\]/);
  assert.match(team, /onOpenRequest\?\.\(ticket\.id\)/);
  assert.match(source("../src/components/ProjectSurfaces.tsx"), /tickets=\{tasks\}/);
});

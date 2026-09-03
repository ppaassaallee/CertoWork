import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  lensToPath,
  resolveDelivereeLens,
} from "../src/lib/delivereeRoutes";

test("canonical IA routes resolve to mental-model lenses", () => {
  assert.deepEqual(resolveDelivereeLens("/home"), { kind: "home" });
  assert.deepEqual(resolveDelivereeLens("/collab"), { kind: "collab" });
  assert.deepEqual(resolveDelivereeLens("/my-work"), {
    kind: "my-work",
    section: "assigned",
  });
  assert.deepEqual(resolveDelivereeLens("/my-work/inbox"), {
    kind: "my-work",
    section: "inbox",
  });
  assert.deepEqual(resolveDelivereeLens("/my-work/waiting"), {
    kind: "my-work",
    section: "waiting",
  });
  assert.deepEqual(resolveDelivereeLens("/my-work/today"), {
    kind: "my-work",
    section: "today",
  });
  assert.deepEqual(resolveDelivereeLens("/projects"), {
    kind: "work",
    section: "portfolio",
  });
  assert.deepEqual(resolveDelivereeLens("/agents"), {
    kind: "agents",
    section: "home",
  });
  assert.deepEqual(resolveDelivereeLens("/agents/automations"), {
    kind: "agents",
    section: "automations",
  });
  assert.deepEqual(resolveDelivereeLens("/agents/activity"), {
    kind: "agents",
    section: "activity",
  });
  assert.deepEqual(resolveDelivereeLens("/workspace"), {
    kind: "more",
    section: "workspace",
  });
  assert.deepEqual(resolveDelivereeLens("/notes"), { kind: "notes" });
  assert.deepEqual(resolveDelivereeLens("/approvals"), { kind: "approvals" });
  assert.deepEqual(resolveDelivereeLens("/invoices"), { kind: "invoices" });
  assert.deepEqual(resolveDelivereeLens("/feedback"), {
    kind: "feedback",
    section: "submit",
  });
  assert.deepEqual(resolveDelivereeLens("/workspace/feedback"), {
    kind: "feedback",
    section: "queue",
  });
});

test("legacy URLs alias into the new IA", () => {
  assert.deepEqual(resolveDelivereeLens("/work"), {
    kind: "work",
    section: "portfolio",
  });
  assert.deepEqual(resolveDelivereeLens("/work/tasks"), {
    kind: "my-work",
    section: "assigned",
  });
  assert.deepEqual(resolveDelivereeLens("/capture"), {
    kind: "my-work",
    section: "inbox",
  });
  assert.deepEqual(resolveDelivereeLens("/more/automations"), {
    kind: "agents",
    section: "automations",
  });
  assert.deepEqual(resolveDelivereeLens("/digest"), {
    kind: "agents",
    section: "activity",
  });
  assert.deepEqual(resolveDelivereeLens("/work/agent-workspace"), {
    kind: "agents",
    section: "home",
  });
  assert.deepEqual(resolveDelivereeLens("/work/projects/abc/tasks"), {
    kind: "project",
    projectId: "abc",
    tab: "tasks",
  });
});

test("lens writers prefer semantic canonical paths", () => {
  assert.equal(lensToPath({ kind: "my-work", section: "assigned" }), "/my-work");
  assert.equal(lensToPath({ kind: "my-work", section: "inbox" }), "/my-work/inbox");
  assert.equal(lensToPath({ kind: "my-work", section: "today" }), "/my-work/today");
  assert.equal(lensToPath({ kind: "my-work", section: "this_week" }), "/my-work/this-week");
  assert.equal(lensToPath({ kind: "notes" }), "/notes");
  assert.equal(lensToPath({ kind: "work", section: "portfolio" }), "/projects");
  assert.equal(lensToPath({ kind: "agents", section: "home" }), "/agents");
  assert.equal(lensToPath({ kind: "agents", section: "automations" }), "/agents/automations");
  assert.equal(lensToPath({ kind: "more", section: "workspace" }), "/workspace");
  assert.equal(lensToPath({ kind: "invoices" }), "/invoices");
  assert.equal(lensToPath({ kind: "feedback", section: "submit" }), "/supportops");
  assert.equal(
    lensToPath({ kind: "feedback", section: "queue" }),
    "/workspace/supportops",
  );
});

test("primary sidebar uses Home / My Work / Projects / Agents / Approvals", () => {
  const source = readFileSync(
    resolve("src/components/DelivereeWorkspace.tsx"),
    "utf8",
  );
  const agents = readFileSync(
    resolve("src/components/agents/AgentsLibrary.tsx"),
    "utf8",
  );
  assert.match(source, /data-testid="nav-home"/);
  assert.match(source, /data-testid="nav-my-work"/);
  assert.match(source, /data-testid="nav-projects"/);
  const notes = readFileSync(resolve("src/components/NotesWorkspace.tsx"), "utf8");
  assert.match(source, /data-testid="nav-notes"/);
  assert.match(notes, /data-testid="notes-workspace"/);
  assert.match(source, /data-testid="nav-agents"/);
  assert.match(source, /data-testid="nav-approvals"/);
  assert.match(source, /data-testid="nav-invoices"/);
  assert.match(source, /data-testid="nav-feedback"/);
  assert.match(source, /data-testid="nav-requests"/);
  assert.match(source, /data-testid="nav-workspace"/);
  assert.match(source, /data-testid="nav-settings"/);
  assert.match(source, /ProductSwitcher/);
  assert.doesNotMatch(source, /\{t\("navMore"\)\}/);
  assert.doesNotMatch(source, /do-odiseus-hire/);
  assert.match(source, /data-testid="sidebar-search"/);
  assert.match(source, /data-testid="my-work-shell"/);
  assert.match(agents, /data-testid="agents-home"/);
  assert.match(agents, /data-testid="agents-library"/);
  assert.match(agents, /do-agents-list/);
  assert.match(agents, /do-agents-row/);
  assert.match(agents, /New agent/);
  assert.doesNotMatch(agents, />\s*Platform\s*</);
  // Agents library home breadcrumb is Agents only — no forced Odysseus segment.
  assert.match(
    source,
    /lens\.section === "automations"[\s\S]*lens\.section === "activity"[\s\S]*: \[\]/,
  );
});

test("opening a project record stays on the project URL, not Home", () => {
  const source = readFileSync(
    resolve("src/components/DelivereeWorkspace.tsx"),
    "utf8",
  );
  const openMatch = source.match(
    /const openProjectRecord = \([\s\S]*?\n {2}\};/,
  );
  const selectMatch = source.match(
    /const selectProjectContext = \([\s\S]*?\n {2}\};/,
  );
  assert.ok(openMatch, "openProjectRecord missing");
  assert.ok(selectMatch, "selectProjectContext missing");
  assert.match(selectMatch[0], /navigate\(`\/work\/projects\/\$\{project\.id\}`\)/);
  assert.doesNotMatch(selectMatch[0], /setPanel\(null\)/);
  assert.doesNotMatch(openMatch[0], /setPanel\(null\)/);
  assert.doesNotMatch(openMatch[0], /goCenterView\("project"\)/);
});

test("Home stays a personal conversation space", () => {
  const source = readFileSync(
    resolve("src/components/DelivereeWorkspace.tsx"),
    "utf8",
  );
  assert.match(source, /selectHomeConversation\(sorted\)/);
  assert.match(source, /privacyScope|personalActor/);
});

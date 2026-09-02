import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  APPLE_WIDGET_COLLECTION,
  buildAppleWidgetSnapshot,
  createAppleWidgetToken,
  isTodayTask,
  priorityRank,
  widgetApiPath,
  widgetPublicPath,
} from "../src/lib/appleWidget";
import worker, {
  decodeFirestoreDocument,
  decodeFirestoreValue,
  loadAppleWidgetSnapshot,
  normalizeAppleWidgetSnapshot,
} from "../worker/index.js";

const rules = readFileSync(resolve("firestore.rules"), "utf8");
const workspace = readFileSync(resolve("src/components/DelivereeWorkspace.tsx"), "utf8");
const app = readFileSync(resolve("src/App.tsx"), "utf8");
const settings = readFileSync(resolve("src/components/AppleWidgetSettings.tsx"), "utf8");
const page = readFileSync(resolve("src/components/PublicAppleWidget.tsx"), "utf8");
const widgetKit = readFileSync(
  resolve("apple/CertoWork/CertoWorkWidget/CertoWorkWidget.swift"),
  "utf8",
);

const now = new Date("2026-08-25T15:00:00");

function environment(overrides: Record<string, unknown> = {}) {
  return {
    ASSETS: {
      async fetch() {
        return new Response("missing", { status: 404 });
      },
    },
    ...overrides,
  };
}

test("today's P1s become the 2 must-dos and remaining today tasks become should-dos", () => {
  const snapshot = buildAppleWidgetSnapshot({
    now,
    workspaceName: "Boldr",
    pendingApprovals: 2,
    projects: [{ id: "p1", title: "Certo Work" }],
    tasks: [
      { id: "a", title: "Ship widgets", priority: 1, dueDate: "2026-08-25", projectId: "p1" },
      { id: "b", title: "Protect core work", isOneThing: true, timeSector: "today" },
      { id: "c", title: "Clear messages", priority: 2, dueDate: "2026-08-25" },
      { id: "d", title: "Later idea", priority: 1, dueDate: "2026-09-01" },
      { id: "e", title: "Already done", priority: 1, dueDate: "2026-08-25", status: "done" },
    ],
  });
  assert.equal(snapshot.workspaceName, "Boldr");
  assert.equal(snapshot.dateKey, "2026-08-25");
  assert.deepEqual(
    snapshot.mustDos.map((item) => item.title),
    ["Protect core work", "Ship widgets"],
  );
  assert.equal(snapshot.mustDos[1].project, "Certo Work");
  assert.deepEqual(
    snapshot.shouldDos.map((item) => item.title),
    ["Clear messages"],
  );
  assert.equal(snapshot.pendingApprovals, 2);
  assert.match(snapshot.odysseusLine, /2 changes waiting/);
});

test("if there is no P1, the first two today tasks become must-dos", () => {
  const snapshot = buildAppleWidgetSnapshot({
    now,
    tasks: [
      { id: "a", title: "Beta", priority: 3, timeSector: "today" },
      { id: "b", title: "Alpha", priority: 2, dueDate: "2026-08-25" },
      { id: "c", title: "Gamma", priority: 2, dueDate: "2026-08-25" },
    ],
  });
  assert.deepEqual(
    snapshot.mustDos.map((item) => item.title),
    ["Alpha", "Gamma"],
  );
  assert.deepEqual(
    snapshot.shouldDos.map((item) => item.title),
    ["Beta"],
  );
  assert.match(snapshot.odysseusLine, /Protect the two must-dos/);
});

test("closed and non-today tasks stay out of the widget", () => {
  assert.equal(isTodayTask({ dueDate: "2026-08-25", status: "done" }, "2026-08-25"), false);
  assert.equal(isTodayTask({ timeSector: "this-week" }, "2026-08-25"), false);
  assert.equal(isTodayTask({ timeSector: "today" }, "2026-08-25"), true);
  assert.equal(isTodayTask({ isOneThing: true, status: "todo" }, "2026-08-25"), true);
  assert.equal(priorityRank("P1"), 1);
  assert.equal(priorityRank("medium"), 2);
});

test("widget share tokens and public paths stay opaque", () => {
  const token = createAppleWidgetToken();
  assert.match(token, /^[a-zA-Z0-9]{16,80}$/);
  assert.equal(widgetPublicPath("abc"), "/widget/abc");
  assert.equal(widgetApiPath("abc"), "/api/widget/abc");
  assert.equal(APPLE_WIDGET_COLLECTION, "widget_tokens");
});

test("Firestore widget tokens are public-get and owner-updated, including snapshot", () => {
  const start = rules.indexOf("match /widget_tokens/{id} {");
  const block = rules.slice(start, rules.indexOf("\n    }", start));
  assert.match(block, /allow get: if resource\.data\.revoked != true/);
  assert.match(block, /incoming\(\)\.snapshot is map/);
  assert.match(workspace, /APPLE_WIDGET_COLLECTION/);
  assert.match(settings, /Enable Apple widgets/);
  assert.match(settings, /Copy WidgetKit feed/);
  assert.match(app, /PublicAppleWidget/);
  assert.match(app, /widgetToken/);
  assert.match(page, /apple-widget-page/);
  assert.match(widgetKit, /CertoWorkToday/);
  assert.match(widgetKit, /systemSmall/);
});

test("Firestore REST maps empty arrays and widget snapshots", () => {
  const decoded = decodeFirestoreDocument({
    token: { stringValue: "tok" },
    revoked: { booleanValue: false },
    snapshot: {
      mapValue: {
        fields: {
          workspaceName: { stringValue: "Boldr" },
          mustDos: { arrayValue: {} },
          shouldDos: {
            arrayValue: {
              values: [
                {
                  mapValue: {
                    fields: {
                      id: { stringValue: "s1" },
                      title: { stringValue: "Clear inbox" },
                    },
                  },
                },
              ],
            },
          },
          pendingApprovals: { integerValue: "0" },
        },
      },
    },
  });
  assert.equal(decoded.token, "tok");
  assert.deepEqual(decodeFirestoreValue({ arrayValue: {} }), []);
  const snapshot = normalizeAppleWidgetSnapshot(decoded.snapshot);
  assert.equal(snapshot?.workspaceName, "Boldr");
  assert.deepEqual(snapshot?.mustDos, []);
  assert.equal(snapshot?.shouldDos[0].title, "Clear inbox");
});

test("Apple widget feed rejects short tokens without calling Firestore", async () => {
  const response = await worker.fetch(
    new Request("https://gazelle.test/api/widget/nope"),
    environment(),
  );
  assert.equal(response.status, 404);
});

test("Apple widget feed returns a decoded snapshot and hides revoked tokens", async () => {
  const token = "a".repeat(32);
  const revoked = "b".repeat(32);
  const original = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    assert.match(url, /widget_tokens/);
    if (url.includes(revoked)) {
      return new Response(
        JSON.stringify({
          fields: {
            token: { stringValue: revoked },
            revoked: { booleanValue: true },
            snapshot: { mapValue: { fields: { workspaceName: { stringValue: "X" } } } },
          },
        }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({
        fields: {
          token: { stringValue: token },
          revoked: { booleanValue: false },
          snapshot: {
            mapValue: {
              fields: {
                workspaceName: { stringValue: "Boldr" },
                dateLabel: { stringValue: "Tue, Aug 25" },
                dateKey: { stringValue: "2026-08-25" },
                mustDos: {
                  arrayValue: {
                    values: [
                      {
                        mapValue: {
                          fields: {
                            id: { stringValue: "t1" },
                            title: { stringValue: "Ship widgets" },
                            project: { stringValue: "Certo Work" },
                          },
                        },
                      },
                    ],
                  },
                },
                shouldDos: { arrayValue: {} },
                pendingApprovals: { integerValue: "1" },
                odysseusLine: { stringValue: "1 change waiting for you" },
                updatedAt: { integerValue: "1" },
              },
            },
          },
        },
      }),
      { status: 200 },
    );
  };
  try {
    const ok = await worker.fetch(
      new Request(`https://gazelle.test/api/widget/${token}`),
      environment(),
    );
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as any;
    assert.equal(body.snapshot.workspaceName, "Boldr");
    assert.equal(body.snapshot.mustDos[0].title, "Ship widgets");
    assert.deepEqual(body.snapshot.shouldDos, []);
    const hidden = await worker.fetch(
      new Request(`https://gazelle.test/api/widget/${revoked}`),
      environment(),
    );
    assert.equal(hidden.status, 404);
    const missing = await loadAppleWidgetSnapshot("missingtokenmissing1");
    assert.equal(missing, null);
  } finally {
    globalThis.fetch = original;
  }
});

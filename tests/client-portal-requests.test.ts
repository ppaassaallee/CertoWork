import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { itemViewZ, portalMetaZ } from "../src/lib/clientPortal/types";

const source = (path: string) => readFileSync(resolve(path), "utf8");

test("client request projection accepts bilingual service-area ticket fields", () => {
  const view = itemViewZ.parse({
    id: "ticket-1", projectId: "project-1", title: "Need support", status: "Received",
    kind: "request", requestKind: "incident", serviceAreaId: "support", ticketStatus: "new",
    description: "The service is down", createdAt: "2026-10-19T00:00:00.000Z",
  });
  assert.equal(view.requestKind, "incident");
  assert.equal(view.serviceAreaId, "support");
  assert.equal(itemViewZ.safeParse({ ...view, requestKind: "not-a-kind" }).success, false);
});

test("portal meta accepts published areas but rejects unknown request kinds", () => {
  const meta = {
    brand: { name: "Client" }, locale: "es",
    nav: { home: 0, projects: 1, requests: 0, invoices: 0, documents: 0, messages: 0, approvals: 0 },
    serviceAreas: [{ id: "support", projectId: "project-1", name: "Soporte", enabled: true, requestKinds: ["request", "incident", "feedback"] }],
  };
  assert.equal(portalMetaZ.parse(meta).serviceAreas?.[0].name, "Soporte");
  assert.equal(portalMetaZ.safeParse({ ...meta, serviceAreas: [{ ...meta.serviceAreas[0], requestKinds: ["unknown"] }] }).success, false);
});

test("client requests require a published area, matching project and active member", () => {
  const backend = source("functions/src/clientPortal/index.ts");
  assert.match(backend, /serviceAreaId/);
  assert.match(backend, /member\.status !== "active"/);
  assert.match(backend, /project\.data\(\)\?\.clientId/);
  assert.match(backend, /workItemType: "ticket"/);
  assert.match(backend, /tx\.set\(canonicalRef/);
  assert.match(backend, /replyPortalRequest/);
  assert.match(backend, /task\.clientId !== clientId/);
  assert.match(backend, /conversation_messages/);
});

test("only external request messages reach the client projection", () => {
  const projection = source("functions/src/collab/onMessageCreated.ts");
  assert.match(projection, /data\.visibility === "external" && conv\.anchor\?\.type === "task"/);
  assert.match(projection, /task\?\.workItemType === "ticket" && task\?\.clientVisible === true/);
  assert.match(projection, /request_messages/);
});

test("task changes project one item and remove stale project access", () => {
  const projector = source("functions/src/clientPortal/projectItems.ts");
  const trigger = source("functions/src/clientPortal/index.ts");
  assert.match(projector, /projectItems\(db: Firestore, projectId: string, taskId\?: string\)/);
  assert.match(projector, /str\(t\.projectId\) !== projectId/);
  assert.match(trigger, /previousProjectId && previousProjectId !== projectId/);
  assert.match(trigger, /projectItems\(db, projectId, event\.params\.taskId\)/);
});

test("both portal languages expose request form and status labels", () => {
  const copy = source("src/portal/PortalContext.tsx");
  assert.equal((copy.match(/requestStatusReceived:/g) || []).length, 2);
  assert.equal((copy.match(/requestKindIncident:/g) || []).length, 2);
  assert.equal((copy.match(/requestNoAreas:/g) || []).length, 2);
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PORTAL_SETTINGS,
  buildItemView,
  buildInvoiceView,
  buildProjectView,
} from "../src/lib/clientPortal/index.ts";

describe("clientPortal projectViews", () => {
  it("builds a project view without leaking internal fields", () => {
    const view = buildProjectView({
      project: {
        id: "p1",
        title: "Banrural",
        health: "on_track",
        stage: "Build",
        phase: "Development",
        internalMargin: 42,
        costHours: 120,
      },
      settings: DEFAULT_PORTAL_SETTINGS,
      openRequests: 2,
      docCount: 1,
    });
    assert.equal(view.name, "Banrural");
    assert.equal(view.openRequests, 2);
    assert.equal("internalMargin" in view, false);
    assert.equal("costHours" in view, false);
  });

  it("maps ticket tasks to request ItemViews", () => {
    const item = buildItemView({
      id: "t1",
      projectId: "p1",
      title: "Access",
      ticketStatus: "new",
      customerStatus: "Received",
      requesterEmail: "a@b.com",
      lastPublicUpdate: "Looking into it",
    });
    assert.equal(item.kind, "request");
    assert.equal(item.status, "Received");
  });

  it("strips admin notes from invoices", () => {
    const inv = buildInvoiceView({
      id: "i1",
      invoiceNumber: "INV-1",
      amount: 100,
      currency: "USD",
      status: "sent",
      adminNote: "secret margin",
      marginPct: 30,
    });
    assert.equal(inv.number, "INV-1");
    assert.equal("adminNote" in inv, false);
    assert.equal("marginPct" in inv, false);
  });
});

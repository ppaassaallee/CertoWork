import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  draftClientWeeklyUpdate,
  shouldAutoPublishUpdate,
} from "../src/lib/clientPortal/weeklyUpdate.ts";
import { portalEmailContent } from "../src/lib/clientPortal/emails.ts";

describe("clientPortal weekly update + emails", () => {
  it("drafts without costs and blocks auto-publish when needsClient exist", () => {
    const draft = draftClientWeeklyUpdate({
      projectId: "p1",
      clientId: "c1",
      workspaceId: "w1",
      authorUid: "u1",
      locale: "en",
      changes: {
        completedTitles: ["A"],
        nextTitles: ["B"],
        needsClient: ["Approve UAT"],
        newRequests: 1,
        closedRequests: 0,
        documentsAdded: 0,
        checkpointsReached: ["Ready for UAT"],
        upcomingDates: ["Go-live"],
      },
    });
    assert.match(draft.summary, /completed/i);
    assert.equal(draft.needsClient.length, 1);
    assert.equal(shouldAutoPublishUpdate({ needsClient: draft.needsClient, autoPublishUpdates: true }), false);
    assert.equal(shouldAutoPublishUpdate({ needsClient: [], autoPublishUpdates: true }), true);
  });

  it("builds EN/ES portal emails with a CTA", () => {
    const en = portalEmailContent({
      kind: "invite",
      locale: "en",
      deepLink: "https://example.com/portal",
      contextLine: "You are invited",
    });
    assert.match(en.subject, /portal/i);
    assert.match(en.html, /Open portal/);
    const es = portalEmailContent({
      kind: "approval",
      locale: "es",
      deepLink: "https://example.com/portal/approvals",
      contextLine: "Necesita decisión",
    });
    assert.match(es.subject, /decisión/i);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PORTAL_SETTINGS,
  parseStrict,
  projectViewZ,
  slugifyClientName,
} from "../src/lib/clientPortal/index.ts";

describe("clientPortal model", () => {
  it("slugifies client names", () => {
    assert.equal(slugifyClientName("Banrural HQ"), "banrural-hq");
  });

  it("strict-parses ProjectView without internal fields", () => {
    const view = parseStrict(projectViewZ, {
      id: "p1",
      name: "Alpha",
      team: [],
      openRequests: 0,
      docCount: 0,
      invoiceSummary: { pending: 0, overdue: 0 },
      visibility: DEFAULT_PORTAL_SETTINGS,
    });
    assert.equal(view.id, "p1");
    assert.throws(() =>
      parseStrict(projectViewZ, {
        ...view,
        internalCost: 999,
      }),
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTemplateBrief, validateBriefNumbers } from "../src/features/brief/buildTemplateBrief";
import { gatherBriefInputs } from "../src/features/brief/gatherBriefInputs";

describe("buildTemplateBrief", () => {
  it("builds headline from real counts only", () => {
    const inputs = gatherBriefInputs({
      dateKey: "2026-09-20",
      tz: "America/Guatemala",
      meetings: [
        {
          eventKey: "e1",
          title: "Standup",
          start: "2026-09-20T09:00:00",
          end: "2026-09-20T09:30:00",
        },
      ],
      approvalCount: 2,
      freeAfternoon: true,
      overdueCount: 1,
      plannedToday: 5,
      focusScore: 72,
      blockedProjects: 0,
    });
    const brief = buildTemplateBrief(inputs, "u1");
    assert.equal(brief.source, "template");
    assert.ok(brief.headline.parts.some((p) => p.kind === "meetings"));
    assert.equal(brief.stats.length, 4);
    assert.equal(validateBriefNumbers(brief, inputs), true);
  });

  it("rejects invented large amounts in polished copy", () => {
    const inputs = gatherBriefInputs({
      dateKey: "2026-09-20",
      tz: "UTC",
      approvalCount: 1,
    });
    const brief = buildTemplateBrief(inputs, "u1");
    const bad = {
      ...brief,
      summary: "You owe $99999 somehow.",
    };
    assert.equal(validateBriefNumbers(bad, inputs), false);
  });
});

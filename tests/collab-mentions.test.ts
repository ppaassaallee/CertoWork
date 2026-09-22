import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMentions, previewFromText } from "../src/lib/collab/mentions";

describe("collab mentions", () => {
  it("parses user/agent/item/project/record/odysseus tokens", () => {
    const text =
      "Hey {{user:u1}} and {{agent:a1}} about {{item:i1}} in {{project:p1}} {{record:t1:r1}} {{odysseus}}";
    const m = parseMentions(text);
    assert.deepEqual(m.userIds, ["u1"]);
    assert.deepEqual(m.agentIds, ["a1"]);
    assert.deepEqual(m.itemIds, ["i1"]);
    assert.deepEqual(m.projectIds, ["p1"]);
    assert.deepEqual(m.recordRefs, [{ tableId: "t1", id: "r1" }]);
    assert.equal(m.odysseus, true);
  });

  it("builds a readable preview", () => {
    assert.equal(previewFromText("Hi {{user:Alex}} {{odysseus}}"), "Hi @Alex @Odysseus");
  });
});

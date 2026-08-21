import assert from "node:assert/strict";
import test from "node:test";
import {
  ODISEUS_NAME,
  ODISEUS_TAGLINE,
  isOdiseusConversation,
} from "../src/lib/odiseus";
import { conversationScopeLabel } from "../src/lib/conversationScope";
import { t } from "../src/lib/i18n";

test("Odiseus brand copy is hire-first", () => {
  assert.equal(ODISEUS_NAME, "Odiseus");
  assert.equal(ODISEUS_TAGLINE, "Not a tool. A hire.");
  assert.equal(t("odiseusName", "en"), "Odiseus");
  assert.match(t("odiseusSubline", "en"), /asks before anything irreversible/i);
});

test("Odiseus conversations keep the legacy chief_of_staff key", () => {
  assert.equal(isOdiseusConversation({ isChiefOfStaff: true }), true);
  assert.equal(isOdiseusConversation({ conversationType: "chief_of_staff" }), true);
  assert.equal(isOdiseusConversation({ conversationType: "project" }), false);
  assert.equal(
    conversationScopeLabel({ conversationType: "chief_of_staff", isChiefOfStaff: true }, [], []),
    "Odiseus",
  );
});

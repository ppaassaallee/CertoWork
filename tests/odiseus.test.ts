import assert from "node:assert/strict";
import test from "node:test";
import {
  ODISEUS_NAME,
  ODISEUS_TAGLINE,
  isOdysseusConversation,
} from "../src/lib/odiseus";
import { conversationScopeLabel } from "../src/lib/conversationScope";
import { t } from "../src/lib/i18n";

test("Odysseus brand copy is hire-first", () => {
  assert.equal(ODISEUS_NAME, "Odysseus");
  assert.equal(ODISEUS_TAGLINE, "Not a tool. A hire.");
  assert.equal(t("odiseusName", "en"), "Odysseus");
  assert.match(t("odiseusWelcomePrompt", "en"), /take off your plate/i);
  assert.match(t("odiseusSubline", "en"), /assign an outcome/i);
});

test("Odysseus conversations keep the legacy chief_of_staff key", () => {
  assert.equal(isOdysseusConversation({ isChiefOfStaff: true }), true);
  assert.equal(isOdysseusConversation({ conversationType: "chief_of_staff" }), true);
  assert.equal(isOdysseusConversation({ conversationType: "project" }), false);
  assert.equal(
    conversationScopeLabel({ conversationType: "chief_of_staff", isChiefOfStaff: true }, [], []),
    "Odysseus",
  );
});

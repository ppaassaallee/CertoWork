import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  isGenericWorkspaceName,
  needsPlatformOnboarding,
  platformCompanyName,
  platformProfileName,
} from "../src/lib/platformOnboarding";

test("platform onboarding is required until name, company, and email exist", () => {
  assert.equal(needsPlatformOnboarding({ email: "ana@certo.work" }), true);
  assert.equal(
    needsPlatformOnboarding({
      displayName: "Ana",
      workspaceName: "Personal Focus",
      email: "ana@certo.work",
    }),
    true,
  );
  assert.equal(
    needsPlatformOnboarding({
      name: "Ana",
      company: "Certo",
      email: "ana@certo.work",
    }),
    false,
  );
  assert.equal(
    needsPlatformOnboarding({
      email: "ana@certo.work",
      platformOnboardedAt: { seconds: 1 },
    }),
    false,
  );
});

test("generic workspace names do not count as a company", () => {
  assert.equal(isGenericWorkspaceName("Personal Focus"), true);
  assert.equal(isGenericWorkspaceName("Certo Work"), true);
  assert.equal(platformCompanyName({ workspaceName: "Certo" }), "Certo");
  assert.equal(platformProfileName({ alias: "Ana", displayName: "hidden" }), "Ana");
});

test("first-run profile lives on Certo Work, not only inside Chat Collab", () => {
  const app = readFileSync(resolve("src/App.tsx"), "utf8");
  const modal = readFileSync(resolve("src/components/PlatformOnboardingModal.tsx"), "utf8");
  assert.match(app, /PlatformOnboardingModal/);
  assert.match(modal, /data-testid="platform-onboarding"/);
  assert.match(modal, /Company/);
  assert.match(modal, /workspace_members/);
});

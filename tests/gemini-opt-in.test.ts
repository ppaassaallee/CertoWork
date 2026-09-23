import assert from "node:assert/strict";
import test from "node:test";
import { getGeminiClient, isGeminiEnabled } from "../server/lib/ai";

test("a Gemini key alone never enables billable Gemini calls", () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFlag = process.env.CERTO_GEMINI_ENABLED;
  try {
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.CERTO_GEMINI_ENABLED;
    assert.equal(isGeminiEnabled(), false);
    assert.throws(() => getGeminiClient(), /Gemini is disabled/);
    process.env.CERTO_GEMINI_ENABLED = "1";
    assert.equal(isGeminiEnabled(), true);
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousFlag === undefined) delete process.env.CERTO_GEMINI_ENABLED;
    else process.env.CERTO_GEMINI_ENABLED = previousFlag;
  }
});

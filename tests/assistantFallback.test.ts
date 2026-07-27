import assert from "node:assert/strict";
import test from "node:test";
import { shouldQueueOfflineCapture } from "../src/lib/assistantFallback";

test("queues a capture when the browser is offline", () => {
  assert.equal(
    shouldQueueOfflineCapture({
      isOnline: false,
      requestStarted: false,
      responseReceived: false,
    }),
    true,
  );
});

test("queues a capture when fetch fails before receiving a response", () => {
  assert.equal(
    shouldQueueOfflineCapture({
      isOnline: true,
      requestStarted: true,
      responseReceived: false,
      errorName: "TypeError",
    }),
    true,
  );
});

test("does not mislabel a provider error response as offline", () => {
  assert.equal(
    shouldQueueOfflineCapture({
      isOnline: true,
      requestStarted: true,
      responseReceived: true,
      errorName: "Error",
    }),
    false,
  );
});

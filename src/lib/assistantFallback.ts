export interface OfflineQueueDecision {
  isOnline: boolean;
  requestStarted: boolean;
  responseReceived: boolean;
  errorName?: string;
}

/**
 * Queue only when the browser is offline or the assistant request failed at
 * the network boundary. An authenticated 4xx/5xx response is a provider
 * failure, not an offline capture.
 */
export function shouldQueueOfflineCapture({
  isOnline,
  requestStarted,
  responseReceived,
  errorName,
}: OfflineQueueDecision) {
  if (!isOnline) return true;
  return requestStarted && !responseReceived && errorName === "TypeError";
}

/** Isolate-local only. These controls never cache cross-tenant application data. */
export function createSingleFlight(maxEntries = 64) {
  const pending = new Map();
  return (key, operation) => {
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= maxEntries) return Promise.resolve().then(operation);
    const promise = Promise.resolve().then(operation).finally(() => {
      if (pending.get(key) === promise) pending.delete(key);
    });
    pending.set(key, promise);
    return promise;
  };
}

/** Reuse only an existing service identity's unexpired OAuth token. */
export function createTokenCache(maxEntries = 8, now = Date.now) {
  const entries = new Map();
  return async (key, load) => {
    const previous = entries.get(key);
    if (previous?.pending) return previous.pending;
    if (previous?.expiresAt > now()) return previous.token;
    if (!entries.has(key) && entries.size >= maxEntries) entries.delete(entries.keys().next().value);
    const entry = {};
    entries.set(key, entry);
    entry.pending = Promise.resolve().then(load).then(({ token, expiresAt }) => {
      entry.token = token;
      entry.expiresAt = expiresAt;
      entry.pending = null;
      return token;
    }).catch((error) => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    });
    return entry.pending;
  };
}

export async function digestCostKey(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Cron is every 15 minutes; channel expiry is checked with a 24-hour lead. */
export function shouldRenewCalendarChannels(scheduledTime = Date.now()) {
  const at = new Date(scheduledTime);
  return Number.isFinite(at.getTime()) && at.getUTCMinutes() === 0;
}

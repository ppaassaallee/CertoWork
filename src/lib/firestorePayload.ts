/**
 * Firestore rejects `undefined` field values. Creation payloads must be plain
 * data: drop undefined, keep null, and leave class instances (FieldValue, Date)
 * untouched.
 */
export function sanitizeFirestorePayload<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeFirestorePayload(entry)) as T;
  }
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined) continue;
      next[key] = sanitizeFirestorePayload(entry);
    }
    return next as T;
  }
  return value;
}

/** Task creates always persist acceptanceCriteria as a string, never undefined. */
export function prepareTaskCreatePayload(data: Record<string, unknown>) {
  const clean = sanitizeFirestorePayload(data);
  const criteria = clean.acceptanceCriteria;
  clean.acceptanceCriteria = criteria == null ? "" : String(criteria);
  return clean;
}

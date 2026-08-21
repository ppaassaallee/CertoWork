const MODERN_KEY = /^[0-9]{2}-([0-9A-Z]{3})-\d{6}$/;
const LEGACY_SEQUENCE = /-(\d+)$/;

export function parseWorkItemSequence(key: string): number {
  const value = String(key || "").trim().toUpperCase();
  const modern = value.match(MODERN_KEY);
  if (modern) {
    const parsed = Number.parseInt(modern[1], 36);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const legacy = value.match(LEGACY_SEQUENCE);
  if (legacy) return Number(legacy[1]) || 0;
  return 0;
}

export function encodeWorkItemSequence(sequence: number): string {
  return Math.max(1, Math.floor(sequence)).toString(36).toUpperCase().padStart(3, "0");
}

export function formatWorkItemDateStamp(date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear() % 100).padStart(2, "0");
  return `${day}${month}${year}`;
}

export function twoDigitToken(random: () => number = Math.random): string {
  return String(Math.floor(Math.min(0.999999, Math.max(0, random())) * 100)).padStart(2, "0");
}

export function nextWorkItemKey(
  existingKeys: Array<string | null | undefined> = [],
  options: { now?: Date; random?: () => number } = {},
): string {
  const sequence =
    existingKeys.reduce((maximum, key) => Math.max(maximum, parseWorkItemSequence(String(key || ""))), 0) + 1;
  return `${twoDigitToken(options.random)}-${encodeWorkItemSequence(sequence)}-${formatWorkItemDateStamp(options.now)}`;
}

export function isModernWorkItemKey(key: string): boolean {
  return MODERN_KEY.test(String(key || "").trim().toUpperCase());
}

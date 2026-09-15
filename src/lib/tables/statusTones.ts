import type { StatusOption } from "./types";

export const STATUS_TONES: StatusOption["tone"][] = [
  "neutral",
  "info",
  "success",
  "warning",
  "danger",
  "purple",
];

/** Next tone in rotation, preferring ones least used among existing options. */
export function nextStatusTone(
  existing: Array<Pick<StatusOption, "tone"> | null | undefined> = [],
): StatusOption["tone"] {
  const counts = new Map<StatusOption["tone"], number>();
  for (const tone of STATUS_TONES) counts.set(tone, 0);
  for (const row of existing) {
    const tone = row?.tone && STATUS_TONES.includes(row.tone) ? row.tone : null;
    if (!tone) continue;
    counts.set(tone, (counts.get(tone) || 0) + 1);
  }
  let best: StatusOption["tone"] = STATUS_TONES[0];
  let bestCount = Number.POSITIVE_INFINITY;
  for (const tone of STATUS_TONES) {
    const count = counts.get(tone) || 0;
    if (count < bestCount) {
      best = tone;
      bestCount = count;
    }
  }
  return best;
}

export function withStatusTone(
  option: Partial<StatusOption> & { id: string; label: string },
  existing: StatusOption[] = [],
): StatusOption {
  const tone =
    option.tone && STATUS_TONES.includes(option.tone)
      ? option.tone
      : nextStatusTone(existing);
  return {
    id: option.id,
    label: option.label,
    tone,
  };
}

/** Fill missing tones on a list (mutates a copy). */
export function ensureStatusOptionTones(
  options: Array<Partial<StatusOption> & { id: string; label: string }> | null | undefined,
): StatusOption[] {
  if (!options?.length) return [];
  const out: StatusOption[] = [];
  for (const option of options) {
    out.push(withStatusTone(option, out));
  }
  return out;
}

import { useCallback, useEffect, useState } from "react";
import { generateBriefClient, loadBrief } from "./generateBriefClient";
import type { Brief } from "./types";
import type { GatherBriefArgs } from "./gatherBriefInputs";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

function generatedAgeMs(brief: Brief): number {
  const raw = brief.generatedAt as { toMillis?: () => number } | string | null;
  if (!raw) return Number.POSITIVE_INFINITY;
  if (typeof raw === "string") return Date.now() - new Date(raw).getTime();
  if (typeof raw.toMillis === "function") return Date.now() - raw.toMillis();
  return Number.POSITIVE_INFINITY;
}

export function useDailyBrief(opts: {
  enabled: boolean;
  uid?: string;
  gather: GatherBriefArgs;
}) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (force = false) => {
      if (!opts.enabled || !opts.uid) return;
      setLoading(true);
      setError(null);
      try {
        const next = await generateBriefClient({
          uid: opts.uid,
          force,
          gather: opts.gather,
        });
        setBrief(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Brief failed");
      } finally {
        setLoading(false);
      }
    },
    [opts.enabled, opts.uid, opts.gather],
  );

  useEffect(() => {
    if (!opts.enabled || !opts.uid) {
      setBrief(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const existing = await loadBrief(opts.uid!, opts.gather.dateKey);
      if (cancelled) return;
      if (existing && generatedAgeMs(existing) < THREE_HOURS_MS) {
        setBrief(existing);
        return;
      }
      await refresh(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [opts.enabled, opts.uid, opts.gather.dateKey]);

  return { brief, loading, error, refresh };
}

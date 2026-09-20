import type { PlanBucket } from "./types";

export const BUCKETS: Record<
  PlanBucket,
  {
    key: PlanBucket;
    label: string;
    hint: string;
    icon: "flame" | "trending-up" | "sparkles";
    bg: string;
    border: string;
    fg: string;
  }
> = {
  fire: {
    key: "fire",
    label: "Fires",
    hint: "Leave these and people notice.",
    icon: "flame",
    bg: "rgba(242,98,15,0.08)",
    border: "rgba(242,98,15,0.35)",
    fg: "#F2620F",
  },
  growth: {
    key: "growth",
    label: "Growth",
    hint: "The work that moves your goals forward.",
    icon: "trending-up",
    bg: "rgba(37,71,196,0.08)",
    border: "rgba(37,71,196,0.35)",
    fg: "#2547C4",
  },
  extra: {
    key: "extra",
    label: "Extras",
    hint: "Helpful, not critical. Do them last, or not at all.",
    icon: "sparkles",
    bg: "rgba(66,66,66,0.06)",
    border: "rgba(66,66,66,0.25)",
    fg: "#424242",
  },
};

export const BUCKET_ORDER: PlanBucket[] = ["fire", "growth", "extra"];

/** Phase 2 focus score weights — Growth > Fires > Extras. */
export const BUCKET_WEIGHT: Record<PlanBucket, number> = {
  growth: 3,
  fire: 2,
  extra: 1,
};

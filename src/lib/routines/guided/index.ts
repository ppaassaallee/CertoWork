import { WRAP_REVIEW_MANIFEST } from "./wrap-review";
import { WEEKLY_PLAN_MANIFEST } from "./weekly-plan";
import type { RecipeManifest } from "../manifest";

export const GUIDED_MANIFESTS: RecipeManifest[] = [
  WRAP_REVIEW_MANIFEST,
  WEEKLY_PLAN_MANIFEST,
];

export function getManifest(id: string): RecipeManifest | null {
  return GUIDED_MANIFESTS.find((m) => m.id === id) || null;
}

export { WRAP_REVIEW_MANIFEST, WEEKLY_PLAN_MANIFEST };

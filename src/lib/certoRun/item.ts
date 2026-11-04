import { isRunWorld } from "./vocab";

/** An item belongs to Certo Run only when it carries a Certo Run world. */
export function isCertoRunItem(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const world = (item as { runWorld?: unknown }).runWorld;
  return typeof world === "string" && isRunWorld(world);
}

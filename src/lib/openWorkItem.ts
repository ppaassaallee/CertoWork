/** Find an item by stable id across the filtered view and the full pool. */
export function findWorkItemById(
  pools: Array<readonly any[] | null | undefined>,
  id: string | null | undefined,
) {
  const key = String(id || "").trim();
  if (!key) return null;
  for (const pool of pools) {
    if (!Array.isArray(pool)) continue;
    const hit = pool.find((item) => String(item?.id || "") === key);
    if (hit) return hit;
  }
  return null;
}

/**
 * Title inputs commit on blur. A click that opens the dialog blurs the input
 * first, and the resulting re-render can drop the click — most often right
 * after a rename. Preventing default on mouse down keeps focus until click.
 */
export function retainFocusForOpen(event: { preventDefault: () => void }) {
  event.preventDefault();
}

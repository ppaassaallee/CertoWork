/** Preserve unchanged listeners across navigation; never cache data across tenants. */
export function reconcileSubscriptionPacks(
  handles: Map<string, () => void>,
  next: Record<string, boolean | string>,
  subscribe: (name: string) => () => void,
) {
  for (const [name, stop] of handles) {
    if (next[name] === true) continue;
    stop();
    handles.delete(name);
  }
  for (const [name, enabled] of Object.entries(next)) {
    if (enabled !== true || handles.has(name)) continue;
    handles.set(name, subscribe(name));
  }
}

export function stopSubscriptionPacks(handles: Map<string, () => void>) {
  for (const stop of handles.values()) stop();
  handles.clear();
}

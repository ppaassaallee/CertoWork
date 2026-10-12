/** Escape always dismisses an open filter or sort popover, including from a field inside it. */
export function shouldDismissFilterOnEscape(key: string) {
  return key === "Escape";
}

/**
 * A native select popup lives outside the popover. Treating that pointer as
 * "outside" closes the panel before the chosen value is committed.
 */
export function filterPointerKeepsOpen(tagName: string, activeTagName = "") {
  const tag = tagName.toUpperCase();
  const active = activeTagName.toUpperCase();
  return tag === "SELECT" || tag === "OPTION" || active === "SELECT";
}

export function toast(message: string, notify?: (msg: string) => void) {
  if (notify) {
    notify(message);
    return;
  }
  if (typeof window !== "undefined") window.alert(message);
}

export function confirmAction(message: string): boolean {
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}

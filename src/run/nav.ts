const WORLD_KEY = "certo-run-world";
const RETURN_KEY = "certo-run-return";

const CLOSED = new Set(["done", "completed", "closed", "archived", "cancelled", "deleted"]);

export function openRunWorldCount(
  rows: Array<{ runWorld?: unknown; status?: unknown }>,
  world: string,
): number {
  return rows.filter((row) => row.runWorld === world && !CLOSED.has(String(row.status || "").toLowerCase())).length;
}

export function lastRunWorld(): string {
  try {
    return localStorage.getItem(WORLD_KEY) || "Pure AI";
  } catch {
    return "Pure AI";
  }
}

export function rememberRunReturn(path: string) {
  const next = path.startsWith("/") && !path.startsWith("/run") ? path : "/home";
  try {
    sessionStorage.setItem(RETURN_KEY, next);
  } catch {
    /* UI convenience only. Run data never goes in browser storage. */
  }
}

export function readRunReturn(): string {
  try {
    const value = sessionStorage.getItem(RETURN_KEY);
    if (value && value.startsWith("/") && !value.startsWith("/run")) return value;
  } catch {
    /* ignore */
  }
  return "/home";
}

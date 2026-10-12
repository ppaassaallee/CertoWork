function localKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Calendar day for a stored value. Date-only strings stay on that day in every timezone. */
export function calendarDateKey(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? "" : localKey(parsed);
    }
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : localKey(value);
  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : localKey(parsed);
  }
  if (typeof value === "object" && value && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const parsed = toDate.call(value) as Date;
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? localKey(parsed) : "";
    }
  }
  return "";
}

/** Due chip shows the calendar day, not a bucket such as "This week". */
export function dueDateChipLabel(value: unknown): string {
  const key = calendarDateKey(value);
  if (!key) return "No date";
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

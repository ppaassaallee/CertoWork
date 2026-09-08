export const CHARGE_LINE_TYPES = [
  "Build",
  "Configuration",
  "Maintenance and Support",
  "Ops Consumptions",
] as const;

export type ChargeLineType = (typeof CHARGE_LINE_TYPES)[number];

const CHARGE_LINE_TYPE_SET = new Set<string>(CHARGE_LINE_TYPES);

/** Soft tint for the Type control (and optional row accent). */
export const CHARGE_LINE_TYPE_COLORS: Record<
  ChargeLineType,
  { bg: string; fg: string; border: string }
> = {
  Build: {
    bg: "color-mix(in srgb, #2f6fed 14%, var(--surface-0))",
    fg: "#1d4fbf",
    border: "color-mix(in srgb, #2f6fed 35%, var(--border))",
  },
  Configuration: {
    bg: "color-mix(in srgb, #c47a12 14%, var(--surface-0))",
    fg: "#8a5400",
    border: "color-mix(in srgb, #c47a12 35%, var(--border))",
  },
  "Maintenance and Support": {
    bg: "color-mix(in srgb, #0f7a6c 14%, var(--surface-0))",
    fg: "#0b5c52",
    border: "color-mix(in srgb, #0f7a6c 35%, var(--border))",
  },
  "Ops Consumptions": {
    bg: "color-mix(in srgb, #7a3af0 12%, var(--surface-0))",
    fg: "#5b23c7",
    border: "color-mix(in srgb, #7a3af0 32%, var(--border))",
  },
};

function token(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Map legacy costType / stage / description / Excel charge types onto the
 * four portfolio charge-line types used in the project cost sheet.
 */
export function normalizeChargeLineType(input: {
  costType?: string | null;
  allocationStage?: string | null;
  description?: string | null;
  category?: string | null;
  direction?: string | null;
  unit?: string | null;
}): ChargeLineType {
  const costType = String(input.costType || "").trim();
  if (CHARGE_LINE_TYPE_SET.has(costType)) return costType as ChargeLineType;

  const haystack = token(
    [
      input.costType,
      input.allocationStage,
      input.description,
      input.category,
      input.unit,
    ].join(" "),
  );

  if (
    haystack.includes("maintenance") ||
    haystack.includes("soporte") ||
    haystack.includes("support") ||
    haystack.includes("recurring")
  ) {
    return "Maintenance and Support";
  }

  if (
    haystack.includes("consum") ||
    haystack.includes("token") ||
    haystack.includes("surcharge") ||
    haystack.includes("pass through") ||
    haystack.includes("ai minute") ||
    haystack.includes("usage") ||
    haystack.includes("ops ")
  ) {
    return "Ops Consumptions";
  }

  if (
    haystack.includes("config") ||
    haystack.includes("onboard") ||
    haystack.includes("deploy") ||
    haystack.includes("implement") ||
    haystack.includes("uat") ||
    haystack.includes("go live")
  ) {
    return "Configuration";
  }

  if (
    haystack.includes("build") ||
    haystack.includes("direct cost") ||
    haystack.includes("direct allocation") ||
    haystack.includes("development")
  ) {
    return "Build";
  }

  const stage = token(input.allocationStage);
  if (stage.includes("support")) return "Maintenance and Support";
  if (stage.includes("operation")) return "Ops Consumptions";
  if (stage.includes("onboard") || stage.includes("deploy")) return "Configuration";
  if (stage.includes("build") || stage.includes("define") || stage.includes("change")) {
    return "Build";
  }

  return "Build";
}

export function isFinanceLineBilled(entry: {
  financialStatus?: string | null;
  invoiceStatus?: string | null;
  costStatus?: string | null;
  paymentStatus?: string | null;
}) {
  const status = token(
    entry.financialStatus || entry.invoiceStatus || entry.costStatus || "",
  );
  if (status === "billed" || status === "paid" || status === "invoiced" || status === "incurred") {
    return true;
  }
  return token(entry.paymentStatus) === "paid";
}

export function financeMonthKey(
  entry: { accountingMonth?: string | null },
  period?: { year?: number; month?: number; label?: string; kind?: string },
) {
  const fromEntry = String(entry.accountingMonth || "").trim();
  if (/^\d{4}-\d{2}/.test(fromEntry)) return fromEntry.slice(0, 7);
  if (period?.year && period?.month) {
    return `${period.year}-${String(period.month).padStart(2, "0")}`;
  }
  if (period?.kind === "build") return "build";
  return String(period?.label || "unscheduled").trim() || "unscheduled";
}

export function financeMonthLabel(monthKey: string) {
  if (monthKey === "build") return "Build / unscheduled";
  if (monthKey === "unscheduled") return "Unscheduled";
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKey;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

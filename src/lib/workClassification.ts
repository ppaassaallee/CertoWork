export const WORK_CATEGORIES = [
  "Client Delivery",
  "Product Development",
  "Internal Operations",
  "Research & Innovation",
  "Personal / Errand",
] as const;

export type WorkCategory = (typeof WORK_CATEGORIES)[number];

export const PRODUCT_PHASES = [
  "Explore",
  "Shape",
  "Build",
  "Beta",
  "Launch",
  "Grow",
] as const;

export type ProductPhase = (typeof PRODUCT_PHASES)[number];

function clean(value: unknown) {
  return String(value || "").trim();
}

function includesAny(value: unknown, terms: string[]) {
  const normalized = clean(value).toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

export function normalizeWorkCategory(value: unknown): WorkCategory | "" {
  const normalized = clean(value).toLowerCase();
  return (
    WORK_CATEGORIES.find(
      (category) => category.toLowerCase() === normalized,
    ) || ""
  );
}

export function normalizeProductPhase(value: unknown): ProductPhase | "" {
  const normalized = clean(value).toLowerCase();
  return (
    PRODUCT_PHASES.find((phase) => phase.toLowerCase() === normalized) || ""
  );
}

export function workCategory(record: any, fallbackProject?: any): WorkCategory {
  const explicit = normalizeWorkCategory(
    record?.workCategory ||
      record?.portfolioCategory ||
      record?.categoryGroup ||
      fallbackProject?.workCategory ||
      fallbackProject?.portfolioCategory ||
      fallbackProject?.categoryGroup,
  );
  if (explicit) return explicit;

  const typeSignal = [
    record?.projectType,
    record?.type,
    record?.category,
    record?.serviceLine,
    fallbackProject?.projectType,
    fallbackProject?.type,
    fallbackProject?.category,
    fallbackProject?.serviceLine,
  ].join(" ");

  if (includesAny(typeSignal, ["product", "platform", "app", "software", "saas"]))
    return "Product Development";
  if (includesAny(typeSignal, ["research", "innovation", "prototype", "experiment"]))
    return "Research & Innovation";
  if (includesAny(typeSignal, ["operations", "internal", "admin"]))
    return "Internal Operations";

  if (
    record?.projectId ||
    fallbackProject ||
    record?.projectKey ||
    record?.client ||
    record?.clientEntity ||
    record?.bpo ||
    record?.deliveryEntity
  )
    return "Client Delivery";

  return "Personal / Errand";
}

export function productPhase(record: any, fallbackProject?: any): ProductPhase {
  return (
    normalizeProductPhase(
      record?.productPhase ||
        record?.roadmapPhase ||
        fallbackProject?.productPhase ||
        fallbackProject?.roadmapPhase,
    ) || "Explore"
  );
}

export function isProductDevelopment(record: any, fallbackProject?: any) {
  return workCategory(record, fallbackProject) === "Product Development";
}

export type DirectionWidgetId =
  | "workload"
  | "overdue"
  | "projects"
  | "money"
  | "controls"
  | "requests";

export const DIRECTION_WIDGET_ORDER: DirectionWidgetId[] = [
  "workload",
  "overdue",
  "projects",
  "money",
  "controls",
  "requests",
];

export type DirectionLayout = {
  hidden: DirectionWidgetId[];
  order: DirectionWidgetId[];
};

const STORAGE_PREFIX = "certo.direction.layout.";

export function defaultDirectionLayout(): DirectionLayout {
  return {
    hidden: [],
    order: [...DIRECTION_WIDGET_ORDER],
  };
}

export function normalizeDirectionLayout(raw: unknown): DirectionLayout {
  const base = defaultDirectionLayout();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as { hidden?: unknown; order?: unknown };
  const hidden = Array.isArray(data.hidden)
    ? data.hidden.filter((id): id is DirectionWidgetId =>
        DIRECTION_WIDGET_ORDER.includes(id as DirectionWidgetId),
      )
    : [];
  const orderRaw = Array.isArray(data.order)
    ? data.order.filter((id): id is DirectionWidgetId =>
        DIRECTION_WIDGET_ORDER.includes(id as DirectionWidgetId),
      )
    : [];
  const order = [
    ...orderRaw,
    ...DIRECTION_WIDGET_ORDER.filter((id) => !orderRaw.includes(id)),
  ];
  return { hidden, order };
}

export function loadDirectionLayout(userId: string): DirectionLayout {
  if (typeof window === "undefined" || !userId) return defaultDirectionLayout();
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return defaultDirectionLayout();
    return normalizeDirectionLayout(JSON.parse(raw));
  } catch {
    return defaultDirectionLayout();
  }
}

export function saveDirectionLayout(userId: string, layout: DirectionLayout) {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.setItem(
    `${STORAGE_PREFIX}${userId}`,
    JSON.stringify(normalizeDirectionLayout(layout)),
  );
}

export function visibleDirectionWidgets(layout: DirectionLayout): DirectionWidgetId[] {
  const normalized = normalizeDirectionLayout(layout);
  return normalized.order.filter((id) => !normalized.hidden.includes(id));
}

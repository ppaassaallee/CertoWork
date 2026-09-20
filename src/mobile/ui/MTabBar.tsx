import type { ReactNode } from "react";

export type MTabItem = {
  id: string;
  label: string;
  to: string;
  icon: ReactNode;
  badge?: number;
};

export function MTabBar({
  items,
  activeId,
  onNavigate,
}: {
  items: MTabItem[];
  activeId: string;
  onNavigate: (to: string) => void;
}) {
  return (
    <nav aria-label="Primary" className="m-tabbar" role="navigation">
      {items.map((item) => (
        <button
          aria-current={item.id === activeId ? "page" : undefined}
          className={item.id === activeId ? "is-active" : ""}
          key={item.id}
          onClick={() => onNavigate(item.to)}
          type="button"
        >
          <span className="m-tabbar-icon">
            {item.icon}
            {item.badge && item.badge > 0 ? (
              <span className="m-tabbar-badge">{item.badge > 99 ? "99+" : item.badge}</span>
            ) : null}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

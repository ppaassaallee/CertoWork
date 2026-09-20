import type { ReactNode } from "react";
import "../../desktop/ui/desktop-ui.css";

export type RailItem = {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  active?: boolean;
  onClick: () => void;
};

export function DesktopIconRail({
  items,
  bottom,
}: {
  items: RailItem[];
  bottom?: ReactNode;
}) {
  return (
    <nav aria-label="Primary" className="d-rail" data-testid="desktop-icon-rail">
      {items.map((it) => (
        <button
          aria-current={it.active ? "page" : undefined}
          aria-label={it.label}
          className={it.active ? "is-active" : ""}
          key={it.id}
          onClick={it.onClick}
          title={it.label}
          type="button"
        >
          {it.icon}
          {it.badge ? (
            <em
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                background: "#F2620F",
                color: "#fff",
                fontSize: 9,
                borderRadius: 99,
                padding: "0 4px",
                fontStyle: "normal",
              }}
            >
              {it.badge}
            </em>
          ) : null}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      {bottom}
    </nav>
  );
}

export function DesktopRailPanel({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <aside className="d-rail-panel" data-testid="desktop-rail-panel">
      {children}
    </aside>
  );
}

/** Mapping of legacy drawer entries → new rail/panel spots (Step 19). */
export const SIDEBAR_MAPPING: Array<{ from: string; to: string }> = [
  { from: "Home", to: "Rail › Home / Panel › Home" },
  { from: "My Work", to: "Rail › My Work / Panel › My Work" },
  { from: "Projects", to: "Rail › Projects / Panel › Workspace › Projects" },
  { from: "Inbox / Approvals", to: "Rail › Inbox / Panel › Inbox" },
  { from: "Invoices", to: "Rail › Billing / Panel › Workspace › Billing" },
  { from: "Costs / Finance", to: "Panel › Workspace › Billing (filtered) + Projects › Costs summary" },
  { from: "Routines", to: "Rail › Routines / Panel › Workspace › Routines" },
  { from: "Notes", to: "Rail › Notes" },
  { from: "Tables", to: "Panel › Workspace › Views / Tables" },
  { from: "Agents", to: "Panel › Workspace › Reports / Agents" },
  { from: "Teams / Members", to: "Panel › Team › members → /admin/members" },
  { from: "Settings", to: "Rail bottom › Settings" },
  { from: "Command palette", to: "Panel top › ⌘K field" },
];

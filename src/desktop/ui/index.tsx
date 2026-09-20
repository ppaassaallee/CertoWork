import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./desktop-ui.css";

export function DButton({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
}) {
  return (
    <button
      className={`d-btn d-btn-${variant}${size === "sm" ? " d-btn-sm" : ""} ${className}`.trim()}
      type={rest.type || "button"}
      {...rest}
    >
      {children}
    </button>
  );
}

export function DIconButton({
  label,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button aria-label={label} className="d-icon-btn" type={rest.type || "button"} {...rest}>
      {children}
    </button>
  );
}

export function DSegmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
}) {
  return (
    <div className="d-segmented" role="tablist">
      {options.map((o) => (
        <button
          aria-selected={o.id === value}
          className={o.id === value ? "is-active" : ""}
          key={o.id}
          onClick={() => onChange(o.id)}
          role="tab"
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DTabs({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
}) {
  return (
    <div className="d-tabs" role="tablist">
      {options.map((o) => (
        <button
          aria-selected={o.id === value}
          className={o.id === value ? "is-active" : ""}
          key={o.id}
          onClick={() => onChange(o.id)}
          role="tab"
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DPill({
  tone = "neutral",
  children,
}: {
  tone?: "paid" | "ok" | "pending" | "warn" | "overdue" | "bad" | "draft" | "neutral" | "cancelled";
  children: ReactNode;
}) {
  return <span className={`d-pill d-pill-${tone}`}>{children}</span>;
}

export function DChip({
  href,
  dot,
  children,
  onClick,
}: {
  href?: string;
  dot?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const style = dot ? ({ ["--dot" as string]: dot } as React.CSSProperties) : undefined;
  if (href) {
    return (
      <a className="d-chip" href={href} onClick={onClick} style={style}>
        <i style={dot ? { background: dot } : undefined} />
        {children}
      </a>
    );
  }
  return (
    <button className="d-chip" onClick={onClick} style={style} type="button">
      <i style={dot ? { background: dot } : undefined} />
      {children}
    </button>
  );
}

export function DAvatar({ label }: { label: string }) {
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || "")
    .join("")
    .toUpperCase();
  return (
    <span className="d-avatar" title={label}>
      {initials || "?"}
    </span>
  );
}

export function DAvatarStack({ labels }: { labels: string[] }) {
  return (
    <span className="d-avatar-stack">
      {labels.slice(0, 4).map((l) => (
        <DAvatar key={l} label={l} />
      ))}
    </span>
  );
}

export function DStatCard({
  label,
  value,
  bad,
  onClick,
}: {
  label: string;
  value: string | number;
  bad?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className={`d-stat${bad ? " is-bad" : ""}`} onClick={onClick} type="button">
      <span className="lbl">{label}</span>
      <span className="val">{value}</span>
    </button>
  );
}

export function DSheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="d-sheet-root">
      <button aria-label="Dismiss" className="d-sheet-scrim" onClick={onClose} type="button" />
      <aside aria-modal className="d-sheet" role="dialog">
        <header className="d-sheet-head">
          <h2>{title}</h2>
          <DIconButton label="Close" onClick={onClose}>
            ✕
          </DIconButton>
        </header>
        <div className="d-sheet-body">{children}</div>
        {footer ? <div className="d-sheet-foot">{footer}</div> : null}
      </aside>
    </div>
  );
}

export function DPopover({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`d-popover ${className}`.trim()}>{children}</div>;
}

export function DTable({
  columns,
  rows,
  selected,
  onToggle,
  onRowClick,
  stickyHeader = true,
}: {
  columns: Array<{ id: string; label: string; numeric?: boolean; width?: string }>;
  rows: Array<{ id: string; cells: Record<string, ReactNode> }>;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onRowClick?: (id: string) => void;
  stickyHeader?: boolean;
}) {
  return (
    <div className="d-table-wrap">
      <table className={`d-table${stickyHeader ? " is-sticky" : ""}`}>
        <thead>
          <tr>
            {onToggle ? (
              <th scope="col" style={{ width: 36 }}>
                <span className="sr-only">Select</span>
              </th>
            ) : null}
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                style={{
                  textAlign: c.numeric ? "right" : undefined,
                  width: c.width,
                  fontVariantNumeric: c.numeric ? "tabular-nums" : undefined,
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onRowClick?.(r.id)}>
              {onToggle ? (
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    aria-label={`Select ${r.id}`}
                    checked={selected?.has(r.id) || false}
                    onChange={() => onToggle(r.id)}
                    type="checkbox"
                  />
                </td>
              ) : null}
              {columns.map((c) => (
                <td
                  key={c.id}
                  className={c.numeric ? "is-mono is-num" : undefined}
                  style={{ textAlign: c.numeric ? "right" : undefined }}
                >
                  {r.cells[c.id]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

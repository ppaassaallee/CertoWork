import type { ButtonHTMLAttributes, ReactNode } from "react";

export function MIconButton({
  label,
  badge,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  badge?: number | boolean;
  children: ReactNode;
}) {
  const showDot = badge === true || (typeof badge === "number" && badge > 0);
  const count = typeof badge === "number" && badge > 0 ? (badge > 99 ? "99+" : String(badge)) : null;
  return (
    <button
      aria-label={label}
      className={`m-icon-btn ${className}`.trim()}
      type={rest.type || "button"}
      {...rest}
    >
      {children}
      {showDot ? (
        <span className={`m-icon-badge${count ? " is-count" : ""}`}>{count}</span>
      ) : null}
    </button>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "../../components/ui/Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

export function MButton({
  variant = "primary",
  size = "md",
  full,
  icon,
  loading,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  icon?: ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      className={`m-btn m-btn-${variant} m-btn-${size}${full ? " is-full" : ""} ${className}`.trim()}
      disabled={disabled || loading}
      type={rest.type || "button"}
      {...rest}
    >
      {loading ? <Loader2 className="spin" size={16} /> : icon}
      {children}
    </button>
  );
}

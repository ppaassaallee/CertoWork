import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronDown } from "../../components/ui/Icon";

export function MChip({
  selected,
  count,
  chevron,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  count?: number;
  chevron?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      className={`m-chip${selected ? " is-selected" : ""} ${className}`.trim()}
      type={rest.type || "button"}
      {...rest}
    >
      <span>{children}</span>
      {typeof count === "number" ? <em>{count}</em> : null}
      {chevron ? <ChevronDown size={14} /> : null}
    </button>
  );
}

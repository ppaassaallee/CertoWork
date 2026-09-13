import type { HTMLAttributes, ReactNode } from "react";

type KbdProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

/** Inline keyboard hint — 10px, hairline, radius 5. */
export function Kbd({ children, className = "", ...props }: KbdProps) {
  return (
    <kbd className={`cw-kbd ${className}`.trim()} {...props}>
      {children}
    </kbd>
  );
}

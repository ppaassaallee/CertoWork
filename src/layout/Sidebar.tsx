import type { ReactNode } from "react";
export { Button } from "../components/ui/Button";

type SidebarProps = {
  children: ReactNode;
  className?: string;
};

export function Sidebar({ children, className }: SidebarProps) {
  return (
    <aside className={className || "do-sidebar"} data-testid="primary-sidebar">
      {children}
    </aside>
  );
}

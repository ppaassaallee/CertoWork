import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";

export function AppShell({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return <div className={className || "do-shell"}>{children || <Outlet />}</div>;
}

import type { ReactNode } from "react";

type HeaderProps = {
  children: ReactNode;
};

export function Header({ children }: HeaderProps) {
  return <header className="do-header">{children}</header>;
}

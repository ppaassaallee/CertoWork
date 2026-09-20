import type { ReactNode } from "react";
import { MButton } from "./MButton";

export function MEmpty({
  icon,
  title,
  actionLabel,
  onAction,
}: {
  icon?: ReactNode;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="m-empty">
      {icon ? <div className="m-empty-icon">{icon}</div> : null}
      <p>{title}</p>
      {actionLabel && onAction ? (
        <MButton onClick={onAction} size="sm" variant="secondary">
          {actionLabel}
        </MButton>
      ) : null}
    </div>
  );
}

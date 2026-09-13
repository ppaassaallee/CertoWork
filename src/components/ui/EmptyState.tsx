import type { ReactNode } from "react";
import { Button } from "./Button";

type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Monochrome schematic of the empty component (gray rows). No themed art. */
  schematic?: "tasks" | "projects" | "none";
  children?: ReactNode;
};

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  schematic = "none",
  children,
}: EmptyStateProps) {
  return (
    <div className="cw-empty" data-testid="cw-empty-state">
      {schematic === "tasks" && (
        <div aria-hidden="true" className="cw-empty-schematic">
          <div className="cw-empty-schematic-row is-done">
            <span className="cw-empty-schematic-dot" />
            <span className="cw-empty-schematic-bar" />
          </div>
          <div className="cw-empty-schematic-row">
            <span className="cw-empty-schematic-dot" />
            <span className="cw-empty-schematic-bar" />
          </div>
          <div className="cw-empty-schematic-row">
            <span className="cw-empty-schematic-dot" />
            <span className="cw-empty-schematic-bar" />
          </div>
        </div>
      )}
      {schematic === "projects" && (
        <div aria-hidden="true" className="cw-empty-schematic">
          <div className="cw-empty-schematic-row">
            <span className="cw-empty-schematic-dot" />
            <span className="cw-empty-schematic-bar" />
          </div>
          <div className="cw-empty-schematic-row">
            <span className="cw-empty-schematic-dot" />
            <span className="cw-empty-schematic-bar" />
          </div>
        </div>
      )}
      <strong>{title}</strong>
      <span>{message}</span>
      {actionLabel && onAction && (
        <Button onClick={onAction} type="button" variant="primary">
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}

import { StatusLight, type StatusTone } from "./StatusLight";
import { X } from "./Icon";

const TONE_BY_KIND: Record<"success" | "warning" | "error" | "info", StatusTone> = {
  success: "green",
  warning: "amber",
  error: "red",
  info: "blue",
};

export function Toast({
  kind = "info",
  children,
  onDismiss,
}: {
  kind?: "success" | "warning" | "error" | "info";
  children: string;
  onDismiss?: () => void;
}) {
  const status = TONE_BY_KIND[kind];
  return (
    <div className={`cw-toast cw-toast--${status}`} role={kind === "error" ? "alert" : "status"}>
      <StatusLight status={status} size="sm" />
      <span>{children}</span>
      {onDismiss ? (
        <button aria-label="Dismiss notification" onClick={onDismiss} title="Dismiss" type="button">
          <X size="sm" />
        </button>
      ) : null}
    </div>
  );
}

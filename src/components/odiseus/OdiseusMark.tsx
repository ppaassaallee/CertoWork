import { ODISEUS_MARK, ODISEUS_NAME } from "../../lib/odiseus";

export function OdiseusMark({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      aria-hidden="true"
      className={`odiseus-mark odiseus-mark--${size}`}
      title={ODISEUS_NAME}
    >
      {ODISEUS_MARK}
    </span>
  );
}

export function OdiseusBadge() {
  return (
    <span className="odiseus-app-badge">
      <OdiseusMark size="sm" />
      <strong>{ODISEUS_NAME}</strong>
      <em>APP</em>
    </span>
  );
}

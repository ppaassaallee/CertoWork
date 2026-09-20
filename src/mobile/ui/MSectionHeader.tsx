import { ChevronDown } from "../../components/ui/Icon";

export function MSectionHeader({
  title,
  count,
  collapsed,
  onToggle,
}: {
  title: string;
  count?: number;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <button className="m-section-head" onClick={onToggle} type="button">
      <ChevronDown className={collapsed ? "is-collapsed" : ""} size={16} />
      <strong>{title}</strong>
      {typeof count === "number" ? <span>{count}</span> : null}
    </button>
  );
}

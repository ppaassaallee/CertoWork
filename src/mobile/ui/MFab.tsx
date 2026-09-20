import { Plus } from "../../components/ui/Icon";

export function MFab({
  label = "Create",
  onClick,
  hidden,
}: {
  label?: string;
  onClick: () => void;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <button aria-label={label} className="m-fab" onClick={onClick} type="button">
      <Plus size={24} />
    </button>
  );
}

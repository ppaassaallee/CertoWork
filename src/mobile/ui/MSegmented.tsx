export function MSegmented({
  value,
  options,
  onChange,
  ariaLabel = "Segments",
}: {
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div aria-label={ariaLabel} className="m-segmented" role="tablist">
      {options.map((opt) => (
        <button
          aria-selected={opt.id === value}
          className={opt.id === value ? "is-active" : ""}
          key={opt.id}
          onClick={() => onChange(opt.id)}
          role="tab"
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

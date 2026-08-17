import { useMemo } from "react";

export function ControlledSelect({
  ariaLabel,
  className,
  disabled,
  fallback = "Internal",
  onAddOption,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  fallback?: string;
  options: string[];
  value?: string | null;
  onChange: (value: string) => void;
  onAddOption?: (name: string) => Promise<string | void> | string | void;
}) {
  const normalizedValue = String(value || fallback || "").trim();
  const selectOptions = useMemo(() => {
    const all = [
      ...new Set(
        [normalizedValue, ...options]
          .map((option) => String(option || "").trim())
          .filter(Boolean),
      ),
    ];
    return all.sort((left, right) => left.localeCompare(right));
  }, [normalizedValue, options]);

  return (
    <select
      aria-label={ariaLabel}
      className={className}
      disabled={disabled}
      onChange={async (event) => {
        const next = event.target.value;
        if (next === "__add_option__") {
          event.currentTarget.value = normalizedValue;
          const name = window.prompt(`Add option for ${ariaLabel}`);
          const cleaned = String(name || "").trim();
          if (!cleaned) return;
          await onAddOption?.(cleaned);
          onChange(cleaned);
          return;
        }
        onChange(next);
      }}
      value={normalizedValue}
    >
      {selectOptions.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
      {onAddOption && <option value="__add_option__">+ Add option…</option>}
    </select>
  );
}

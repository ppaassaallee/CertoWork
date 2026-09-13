import { useEffect, useId, useState, type ReactNode } from "react";
import { AlertTriangle, X } from "./Icon";
import { Button } from "./Button";

export type DestructiveOption = {
  id: string;
  title: string;
  explanation: string;
};

export type DestructiveDialogProps = {
  open: boolean;
  verb: string;
  entityName: string;
  description?: ReactNode;
  /** Live impact lines — dialog should not open until these are ready. */
  impact: string[];
  options?: DestructiveOption[];
  defaultOptionId?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  icon?: ReactNode;
  onCancel: () => void;
  onConfirm: (optionId?: string) => void | Promise<void>;
};

/**
 * Consequence-first destructive dialog.
 * Shows impact counts and handling options — never a vague confirmation prompt.
 */
export function DestructiveDialog({
  open,
  verb,
  entityName,
  description,
  impact,
  options,
  defaultOptionId,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  icon,
  onCancel,
  onConfirm,
}: DestructiveDialogProps) {
  const titleId = useId();
  const [optionId, setOptionId] = useState(
    defaultOptionId || options?.[0]?.id || "",
  );

  useEffect(() => {
    if (!open) return;
    setOptionId(defaultOptionId || options?.[0]?.id || "");
  }, [open, defaultOptionId, options]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const label = confirmLabel || verb;

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="cw-destructive"
      data-testid="destructive-dialog"
      role="dialog"
    >
      <button
        aria-label="Close"
        className="cw-destructive-scrim"
        disabled={busy}
        onClick={onCancel}
        type="button"
      />
      <div className="cw-destructive-panel">
        <button
          aria-label="Close"
          className="cw-destructive-close"
          disabled={busy}
          onClick={onCancel}
          type="button"
        >
          <X size={16} />
        </button>
        <div className="cw-destructive-icon" aria-hidden="true">
          {icon || <AlertTriangle size={22} />}
        </div>
        <h2 id={titleId}>{verb}</h2>
        <p>
          {description || (
            <>
              This will affect <strong>{entityName}</strong>.
            </>
          )}
        </p>
        {options && options.length > 0 && (
          <div className="cw-destructive-options" role="radiogroup">
            {options.map((option) => (
              <label
                className={`cw-destructive-option ${optionId === option.id ? "is-selected" : ""}`}
                key={option.id}
              >
                <input
                  checked={optionId === option.id}
                  name="destructive-option"
                  onChange={() => setOptionId(option.id)}
                  type="radio"
                  value={option.id}
                />
                <span>
                  <strong>{option.title}</strong>
                  <small>{option.explanation}</small>
                </span>
              </label>
            ))}
          </div>
        )}
        {impact.length > 0 && (
          <div className="cw-destructive-impact" role="status">
            <AlertTriangle size={14} />
            <ul>
              {impact.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="cw-destructive-actions">
          <Button disabled={busy} onClick={onCancel} type="button" variant="secondary">
            {cancelLabel}
          </Button>
          <Button
            disabled={busy}
            onClick={() => void onConfirm(options?.length ? optionId : undefined)}
            type="button"
            variant="destructive"
          >
            {busy ? "Working…" : label}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { X } from "../../components/ui/Icon";
import { t } from "../../lib/i18n";

export type NoteQuickCaptureProps = {
  open: boolean;
  locale: "es" | "en";
  linkLabel?: string | null;
  onClose: () => void;
  onSave: (input: {
    title: string;
    body: string;
    link: boolean;
  }) => void | Promise<void>;
};

export function NoteQuickCapture({
  open,
  locale,
  linkLabel,
  onClose,
  onSave,
}: NoteQuickCaptureProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState(Boolean(linkLabel));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setBody("");
    setLink(Boolean(linkLabel));
  }, [open, linkLabel]);

  if (!open) return null;

  return (
    <div className="cw-notes-modal-backdrop" data-testid="note-quick-capture">
      <div className="cw-notes-modal" style={{ width: 480, maxWidth: "92vw" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ flex: 1 }}>{locale === "es" ? "Nota rápida" : "Quick note"}</strong>
          <button onClick={onClose} type="button">
            <X size={14} />
          </button>
        </header>
        <input
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("notes.untitled")}
          style={{ width: "100%", marginTop: 12, fontSize: 16, padding: 8 }}
          value={title}
        />
        <textarea
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("notes.bodyPlaceholder")}
          rows={6}
          style={{ width: "100%", marginTop: 8, fontSize: 13, padding: 8 }}
          value={body}
        />
        {linkLabel ? (
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, fontSize: 12 }}>
            <input checked={link} onChange={(e) => setLink(e.target.checked)} type="checkbox" />
            {locale === "es" ? "Vincular a" : "Link to"} {linkLabel}
          </label>
        ) : null}
        <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button onClick={onClose} type="button">
            {locale === "es" ? "Cancelar" : "Cancel"}
          </button>
          <button
            disabled={busy || (!title.trim() && !body.trim())}
            onClick={() => {
              setBusy(true);
              void Promise.resolve(onSave({ title: title.trim(), body, link }))
                .then(onClose)
                .finally(() => setBusy(false));
            }}
            type="button"
          >
            {locale === "es" ? "Guardar" : "Save"}
          </button>
        </footer>
      </div>
    </div>
  );
}

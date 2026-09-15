import { useState } from "react";
import { t } from "../../lib/i18n";
import type { NotebookEntry } from "../../lib/notebookContext";
import { withDefaults, type NoteType, type NoteVisibility } from "../../lib/notes";

export type NoteMetaChipsProps = {
  note: NotebookEntry;
  projectTitle?: string;
  locale: "es" | "en";
  onType: (type: NoteType) => void;
  onVisibility: (visibility: NoteVisibility) => void;
  onAiVisible: (value: boolean) => void;
  onTags: (tags: string[]) => void;
  onOpenLinks?: () => void;
};

const TYPES: NoteType[] = ["note", "meeting", "idea", "spec", "journal", "review", "client"];

export function NoteMetaChips({
  note,
  projectTitle,
  locale,
  onType,
  onVisibility,
  onAiVisible,
  onTags,
  onOpenLinks,
}: NoteMetaChipsProps) {
  const ext = withDefaults(note);
  const [open, setOpen] = useState<string | null>(null);

  const visLabel =
    ext.visibility === "workspace"
      ? locale === "es"
        ? "Equipo"
        : "Team"
      : ext.visibility === "project"
        ? `${locale === "es" ? "Proyecto" : "Project"} · ${projectTitle || ""}`
        : locale === "es"
          ? "Personal"
          : "Personal";

  return (
    <div className="cw-notes-chips" data-testid="note-meta-chips">
      <div style={{ position: "relative" }}>
        <button className="cw-notes-chip" onClick={() => setOpen(open === "type" ? null : "type")} type="button">
          {ext.noteType || "note"}
        </button>
        {open === "type" ? (
          <div className="cw-notes-popover">
            {TYPES.map((type) => (
              <button
                key={type}
                onClick={() => {
                  onType(type);
                  setOpen(null);
                }}
                type="button"
              >
                {type}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ position: "relative" }}>
        <button
          className={`cw-notes-chip ${ext.visibility ? "" : "is-empty"}`}
          onClick={() => setOpen(open === "vis" ? null : "vis")}
          type="button"
        >
          {visLabel}
        </button>
        {open === "vis" ? (
          <div className="cw-notes-popover">
            {(
              [
                ["private", locale === "es" ? "Personal" : "Personal"],
                ["workspace", locale === "es" ? "Equipo" : "Team"],
                ["project", locale === "es" ? "Proyecto" : "Project"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => {
                  if (ext.visibility === "private" && value !== "private") {
                    const ok = window.confirm(
                      locale === "es"
                        ? "Todo el equipo la va a ver"
                        : "The whole team will see it",
                    );
                    if (!ok) return;
                  }
                  onVisibility(value);
                  setOpen(null);
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {ext.noteType === "meeting" ? (
        <button className={`cw-notes-chip ${(ext.attendeeIds || []).length ? "" : "is-empty"}`} type="button">
          {(ext.attendeeIds || []).length
            ? `${(ext.attendeeIds || []).length} ${locale === "es" ? "asistentes" : "attendees"}`
            : locale === "es"
              ? "Asistentes"
              : "Attendees"}
        </button>
      ) : null}

      <button className="cw-notes-chip" onClick={() => onOpenLinks?.()} type="button">
        {locale === "es" ? "Vinculados" : "Linked"} {ext.linkCount || 0}
      </button>

      <button
        className={`cw-notes-chip ${(note.tags || []).length ? "" : "is-empty"}`}
        onClick={() => {
          const next = window.prompt(
            locale === "es" ? "Etiquetas (coma)" : "Tags (comma)",
            (note.tags || []).join(", "),
          );
          if (next == null) return;
          onTags(
            next
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          );
        }}
        type="button"
      >
        {(note.tags || []).length ? (note.tags || []).join(" · ") : locale === "es" ? "Etiquetas" : "Tags"}
      </button>

      <button
        className={`cw-notes-chip ${ext.aiVisible ? "is-accent" : "is-empty"}`}
        onClick={() => onAiVisible(!ext.aiVisible)}
        type="button"
      >
        {t("notes.aiVisible")}
      </button>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { htmlToMarkdown, markdownToHtml } from "../lib/noteMarkup";
import {
  insertBlockIntoMarkdown,
  SEMANTIC_BLOCKS,
  type SemanticBlockType,
} from "../lib/semanticBlocks";
import { getLocale, t } from "../lib/i18n";
import "./semanticBlocks.css";
import "../features/notes/notes.css";

type Props = {
  noteId: string;
  value: string;
  onChange: (content: string) => void;
};

function runCommand(command: string, argument?: string) {
  document.execCommand("styleWithCSS", false, "false");
  document.execCommand("defaultParagraphSeparator", false, "p");
  document.execCommand(command, false, argument);
}

function wrapCode() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    runCommand("insertHTML", "<code>code</code>");
    return;
  }
  const range = selection.getRangeAt(0);
  const code = document.createElement("code");
  code.appendChild(range.extractContents());
  range.insertNode(code);
  selection.removeAllRanges();
  const next = document.createRange();
  next.selectNodeContents(code);
  next.collapse(false);
  selection.addRange(next);
}

export function NoteRichEditor({ noteId, value, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const focusedRef = useRef(false);
  const locale = getLocale();
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [float, setFloat] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const field = editorRef.current;
    if (!field || focusedRef.current) return;
    const html = markdownToHtml(value);
    field.innerHTML = html || "";
    field.dataset.empty = html.trim() ? "false" : "true";
  }, [noteId, value]);

  useEffect(() => {
    const onSel = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !editorRef.current?.contains(selection.anchorNode)) {
        setFloat(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const host = editorRef.current.getBoundingClientRect();
      setFloat({
        top: Math.max(0, rect.top - host.top - 36),
        left: Math.max(0, rect.left - host.left),
      });
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const emit = () => {
    const field = editorRef.current;
    if (!field) return;
    const markdown = htmlToMarkdown(field.innerHTML);
    field.dataset.empty = markdown ? "false" : "true";
    onChange(markdown);
  };

  const apply = (command: string, argument?: string) => {
    editorRef.current?.focus();
    if (command === "formatBlock" && argument) {
      const tag = argument.replace(/[<>]/g, "");
      runCommand("formatBlock", `<${tag}>`);
    } else if (command === "createLink") {
      const url = window.prompt("URL");
      if (!url) return;
      runCommand("createLink", url);
    } else {
      runCommand(command, argument);
    }
    emit();
  };

  const insertBlock = (type: SemanticBlockType) => {
    const next = insertBlockIntoMarkdown(value, type, "");
    onChange(next);
    setSlashOpen(false);
    setSlashQuery("");
    requestAnimationFrame(() => {
      const field = editorRef.current;
      if (!field) return;
      field.innerHTML = markdownToHtml(next);
      field.dataset.empty = "false";
    });
  };

  const slashOptions = SEMANTIC_BLOCKS.filter((block) => !block.aiOnly).filter((block) => {
    if (!slashQuery) return true;
    const q = slashQuery.toLowerCase();
    return (
      block.type.includes(q) ||
      block.labelEs.toLowerCase().includes(q) ||
      block.labelEn.toLowerCase().includes(q)
    );
  });

  return (
    <div className="do-notes-write" style={{ position: "relative" }}>
      {float ? (
        <div
          className="cw-notes-float-bar"
          data-testid="notes-float-toolbar"
          role="toolbar"
          style={{ top: float.top, left: float.left }}
        >
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => apply("bold")} type="button">
            <strong>B</strong>
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => apply("italic")} type="button">
            <em>I</em>
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => apply("strikeThrough")} type="button">
            <s>S</s>
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editorRef.current?.focus();
              wrapCode();
              emit();
            }}
            type="button"
          >
            Código
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => apply("formatBlock", "h2")} type="button">
            H2
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => apply("formatBlock", "h3")} type="button">
            H3
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => apply("insertUnorderedList")} type="button">
            Lista
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => apply("createLink")} type="button">
            Enlace
          </button>
        </div>
      ) : null}

      {slashOpen && (
        <div className="cw-slash-menu" data-testid="semantic-slash-menu">
          <input
            autoFocus
            onChange={(event) => setSlashQuery(event.target.value)}
            placeholder={locale === "es" ? "Buscar bloque…" : "Search block…"}
            value={slashQuery}
          />
          <div className="cw-slash-list">
            {slashOptions.map((block) => (
              <button key={block.type} onClick={() => insertBlock(block.type)} type="button">
                <span className="cw-semantic-chip" data-hue={block.hue}>
                  {locale === "es" ? block.labelEs : block.labelEn}
                </span>
              </button>
            ))}
            {!slashOptions.length && (
              <span className="cw-slash-empty">
                {locale === "es" ? "Sin resultados" : "No matches"}
              </span>
            )}
          </div>
        </div>
      )}

      <div
        aria-label="Note content"
        className="do-notes-rich"
        contentEditable
        data-empty="true"
        data-placeholder={t("notes.bodyPlaceholder")}
        onBlur={() => {
          focusedRef.current = false;
          emit();
        }}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onInput={(event) => {
          emit();
          const text = (event.target as HTMLDivElement).innerText || "";
          if (text.trimEnd().endsWith("/")) {
            setSlashOpen(true);
            setSlashQuery("");
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && slashOpen) {
            event.preventDefault();
            setSlashOpen(false);
          }
        }}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
    </div>
  );
}

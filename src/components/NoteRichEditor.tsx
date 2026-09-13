import { useEffect, useRef, useState } from "react";
import { htmlToMarkdown, markdownToHtml } from "../lib/noteMarkup";
import {
  insertBlockIntoMarkdown,
  SEMANTIC_BLOCKS,
  type SemanticBlockType,
} from "../lib/semanticBlocks";
import { getLocale } from "../lib/i18n";
import "./semanticBlocks.css";

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

  useEffect(() => {
    const field = editorRef.current;
    if (!field || focusedRef.current) return;
    const html = markdownToHtml(value);
    field.innerHTML = html || "";
    field.dataset.empty = html.trim() ? "false" : "true";
  }, [noteId, value]);

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
    // Force DOM refresh even if focused
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
    <div className="do-notes-write">
      <div className="do-notes-format" role="toolbar" aria-label="Note formatting">
        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply("formatBlock", "h1")}
          title="Title"
          type="button"
        >
          Title
        </button>
        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply("formatBlock", "h2")}
          title="Heading"
          type="button"
        >
          H2
        </button>
        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply("formatBlock", "h3")}
          title="Subheading"
          type="button"
        >
          H3
        </button>
        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply("formatBlock", "p")}
          title="Body text"
          type="button"
        >
          Body
        </button>
        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply("bold")}
          title="Bold"
          type="button"
        >
          <strong>B</strong>
        </button>
        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply("italic")}
          title="Italic"
          type="button"
        >
          <em>I</em>
        </button>
        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            editorRef.current?.focus();
            wrapCode();
            emit();
          }}
          title="Code"
          type="button"
        >
          Code
        </button>
        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply("strikeThrough")}
          title="Strikethrough"
          type="button"
        >
          <s>S</s>
        </button>
        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply("insertUnorderedList")}
          title="List"
          type="button"
        >
          List
        </button>
        <button
          data-testid="notes-slash-blocks"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setSlashOpen((open) => !open);
            setSlashQuery("");
          }}
          title={locale === "es" ? "Bloques /" : "Blocks /"}
          type="button"
        >
          /
        </button>
      </div>

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
              <button
                key={block.type}
                onClick={() => insertBlock(block.type)}
                type="button"
              >
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
        data-placeholder="Write the note here. Use Title, headings, bold, italic, or / for blocks."
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

import { useEffect, useMemo, useRef, useState } from "react";
import { htmlToMarkdown, markdownToHtml } from "../lib/noteMarkup";
import {
  insertBlockIntoMarkdown,
  SEMANTIC_BLOCKS,
  type SemanticBlockType,
} from "../lib/semanticBlocks";
import { getLocale, t } from "../lib/i18n";
import { LayoutGrid } from "./ui/Icon";
import "./semanticBlocks.css";
import "../features/notes/notes.css";

export type NoteMentionItem = {
  id: string;
  title?: string;
  key?: string;
  projectTitle?: string;
  kind?: string;
};

export type NoteMentionPerson = {
  id: string;
  displayName?: string;
  name?: string;
  userId?: string;
};

export type NoteMentionRecord = {
  id: string;
  title?: string;
  tableId: string;
  tableName: string;
  tableIcon?: string;
};

type Props = {
  noteId: string;
  value: string;
  onChange: (content: string) => void;
  items?: NoteMentionItem[];
  records?: NoteMentionRecord[];
  people?: NoteMentionPerson[];
  onLinkTask?: (taskId: string) => void;
  onLinkRecord?: (recordId: string, tableId: string) => void;
  onMentionPerson?: (person: NoteMentionPerson) => void;
};

type MentionKind = "task" | "person" | "record";

type CombinedMention =
  | { kind: "task"; item: NoteMentionItem }
  | { kind: "record"; item: NoteMentionRecord };

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

function insertMarkdownChip(markdown: string, field: HTMLDivElement, onChange: (v: string) => void) {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0 && field.contains(selection.anchorNode)) {
    const range = selection.getRangeAt(0);
    const before = range.startContainer.textContent || "";
    const offset = range.startOffset;
    // Remove the trigger token (#query or @query) before the caret when present.
    const left = before.slice(0, offset);
    const trigger = left.match(/(?:^|[\s\n])([#@][^\s]*)$/);
    if (trigger && range.startContainer.nodeType === Node.TEXT_NODE) {
      const start = offset - trigger[1].length;
      const textNode = range.startContainer as Text;
      textNode.deleteData(start, trigger[1].length);
      range.setStart(textNode, start);
      range.collapse(true);
    }
    const html = markdownToHtml(markdown).replace(/^<p>|<\/p>$/g, "");
    const temp = document.createElement("div");
    temp.innerHTML = html || markdown;
    const frag = document.createDocumentFragment();
    while (temp.firstChild) frag.appendChild(temp.firstChild);
    range.insertNode(frag);
    selection.removeAllRanges();
  }
  const next = htmlToMarkdown(field.innerHTML);
  field.dataset.empty = next ? "false" : "true";
  onChange(next);
}

export function NoteRichEditor({
  noteId,
  value,
  onChange,
  items = [],
  records = [],
  people = [],
  onLinkTask,
  onLinkRecord,
  onMentionPerson,
}: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const focusedRef = useRef(false);
  const locale = getLocale();
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionKind, setMentionKind] = useState<MentionKind>("task");
  const [mentionQuery, setMentionQuery] = useState("");
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

  const hashMentions = useMemo((): CombinedMention[] => {
    const q = mentionQuery.trim().toLowerCase();
    const taskHits: CombinedMention[] = items
      .filter((item) => {
        const hay = `${item.key || ""} ${item.title || ""} ${item.projectTitle || ""}`.toLowerCase();
        return !q || hay.includes(q);
      })
      .slice(0, 6)
      .map((item) => ({ kind: "task" as const, item }));
    const recordHits: CombinedMention[] = records
      .filter((record) => {
        const hay = `${record.title || ""} ${record.tableName || ""}`.toLowerCase();
        return !q || hay.includes(q);
      })
      .slice(0, 6)
      .map((item) => ({ kind: "record" as const, item }));
    return [...taskHits, ...recordHits].slice(0, 10);
  }, [items, mentionQuery, records]);

  const personMentions = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    return people
      .filter((person) => {
        const hay = `${person.displayName || ""} ${person.name || ""}`.toLowerCase();
        return !q || hay.includes(q);
      })
      .slice(0, 8);
  }, [mentionQuery, people]);

  const pickTask = (item: NoteMentionItem) => {
    const field = editorRef.current;
    if (!field) return;
    const label = `#${item.key || item.title || item.id}`;
    insertMarkdownChip(`[${label}](item:${item.id})`, field, onChange);
    onLinkTask?.(item.id);
    setMentionOpen(false);
    setMentionQuery("");
  };

  const pickRecord = (record: NoteMentionRecord) => {
    const field = editorRef.current;
    if (!field) return;
    const label = `#${record.title || record.id}`;
    insertMarkdownChip(`[${label}](record:${record.id})`, field, onChange);
    onLinkRecord?.(record.id, record.tableId);
    setMentionOpen(false);
    setMentionQuery("");
    setMentionKind("record");
  };

  const pickPerson = (person: NoteMentionPerson) => {
    const field = editorRef.current;
    if (!field) return;
    const name = person.displayName || person.name || person.id;
    insertMarkdownChip(`[@${name}](person:${person.id})`, field, onChange);
    onMentionPerson?.(person);
    setMentionOpen(false);
    setMentionQuery("");
  };

  const detectTrigger = (text: string) => {
    const trimmed = text.replace(/\u00a0/g, " ");
    if (trimmed.trimEnd().endsWith("/")) {
      setSlashOpen(true);
      setSlashQuery("");
      setMentionOpen(false);
      return;
    }
    const hash = trimmed.match(/(?:^|[\s\n])#([^\s#@]*)$/);
    if (hash) {
      setMentionOpen(true);
      setMentionKind("task");
      setMentionQuery(hash[1] || "");
      setSlashOpen(false);
      return;
    }
    const at = trimmed.match(/(?:^|[\s\n])@([^\s#@]*)$/);
    if (at) {
      setMentionOpen(true);
      setMentionKind("person");
      setMentionQuery(at[1] || "");
      setSlashOpen(false);
      return;
    }
    setMentionOpen(false);
  };

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

      {mentionOpen && (
        <div className="cw-slash-menu" data-testid="notes-mention-menu">
          <input
            autoFocus
            onChange={(event) => setMentionQuery(event.target.value)}
            placeholder={
              mentionKind === "person"
                ? locale === "es"
                  ? "Buscar persona…"
                  : "Search person…"
                : locale === "es"
                  ? "Buscar ítem o registro…"
                  : "Search item or record…"
            }
            value={mentionQuery}
          />
          <div className="cw-slash-list">
            {mentionKind === "person"
              ? personMentions.map((person) => (
                  <button key={person.id} onClick={() => pickPerson(person)} type="button">
                    <span className="cw-notes-ent cw-notes-ent-person">
                      @{person.displayName || person.name || person.id}
                    </span>
                  </button>
                ))
              : hashMentions.map((entry) =>
                  entry.kind === "task" ? (
                    <button key={`task-${entry.item.id}`} onClick={() => pickTask(entry.item)} type="button">
                      <span className="cw-notes-ent cw-notes-ent-task">
                        #{entry.item.key || entry.item.title || entry.item.id}
                      </span>
                      {entry.item.projectTitle ? (
                        <em style={{ color: "var(--text-muted)", marginLeft: 6 }}>
                          {entry.item.projectTitle}
                        </em>
                      ) : null}
                    </button>
                  ) : (
                    <button
                      key={`record-${entry.item.id}`}
                      onClick={() => pickRecord(entry.item)}
                      type="button"
                    >
                      <span className="cw-notes-ent cw-notes-ent-record">
                        <LayoutGrid size={12} style={{ marginRight: 4 }} />
                        #{entry.item.title || entry.item.id}
                      </span>
                      <em style={{ color: "var(--text-muted)", marginLeft: 6 }}>
                        {entry.item.tableName}
                      </em>
                    </button>
                  ),
                )}
            {(mentionKind === "person" ? !personMentions.length : !hashMentions.length) && (
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
          detectTrigger((event.target as HTMLDivElement).innerText || "");
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && (slashOpen || mentionOpen)) {
            event.preventDefault();
            setSlashOpen(false);
            setMentionOpen(false);
          }
        }}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
    </div>
  );
}

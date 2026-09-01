import { useEffect, useRef } from "react";
import { htmlToMarkdown, markdownToHtml } from "../lib/noteMarkup";

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
      </div>
      <div
        aria-label="Note content"
        className="do-notes-rich"
        contentEditable
        data-empty="true"
        data-placeholder="Write the note here. Use Title, headings, bold, and italic — what you see is what you get."
        onBlur={() => {
          focusedRef.current = false;
          emit();
        }}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onInput={emit}
        ref={editorRef}
        role="textbox"
        suppressContentEditableWarning
      />
    </div>
  );
}

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Hash, Icon, Send } from "../../components/ui/Icon";

const DRAFT_PREFIX = "collab-draft:";

export function draftStorageKey(conversationId: string) {
  return `${DRAFT_PREFIX}${conversationId}`;
}

export function readDraft(conversationId: string): string {
  if (!conversationId || typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(draftStorageKey(conversationId)) || "";
  } catch {
    return "";
  }
}

export function writeDraft(conversationId: string, text: string) {
  if (!conversationId || typeof localStorage === "undefined") return;
  try {
    const key = draftStorageKey(conversationId);
    if (!text.trim()) localStorage.removeItem(key);
    else localStorage.setItem(key, text);
  } catch {
    /* ignore quota */
  }
}

type Props = {
  conversationId: string;
  disabled?: boolean;
  placeholder?: string;
  onSend: (text: string) => Promise<void> | void;
};

/** Message composer: Enter sends, Shift+Enter newline; drafts keyed by conversation. */
export function CollabComposer({
  conversationId,
  disabled,
  placeholder = "Write a message…",
  onSend,
}: Props) {
  const [text, setText] = useState(() => readDraft(conversationId));
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(readDraft(conversationId));
  }, [conversationId]);

  useEffect(() => {
    writeDraft(conversationId, text);
  }, [conversationId, text]);

  const submit = useCallback(async () => {
    const body = text.trim();
    if (!body || disabled || sending) return;
    setSending(true);
    try {
      await onSend(body);
      setText("");
      writeDraft(conversationId, "");
      taRef.current?.focus();
    } finally {
      setSending(false);
    }
  }, [conversationId, disabled, onSend, sending, text]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const insertStub = (token: string) => {
    setText((prev) => {
      const next = prev ? `${prev}${prev.endsWith(" ") || !prev ? "" : " "}${token}` : token;
      return next;
    });
    taRef.current?.focus();
  };

  return (
    <div className="do-collab-composer">
      <div className="do-collab-composer-tools" aria-label="Insert helpers">
        <button type="button" className="do-collab-composer-tool" onClick={() => insertStub("@")} title="@ mention">
          <Icon name="AtSign" size={14} />
          <span>@</span>
        </button>
        <button type="button" className="do-collab-composer-tool" onClick={() => insertStub("#")} title="# link">
          <Hash size={14} />
          <span>#</span>
        </button>
        <button type="button" className="do-collab-composer-tool" onClick={() => insertStub("/")} title="/ command">
          <span>/</span>
        </button>
      </div>
      <div className="do-collab-composer-row">
        <textarea
          ref={taRef}
          className="do-collab-composer-input"
          value={text}
          disabled={disabled || sending}
          placeholder={placeholder}
          rows={2}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          data-testid="collab-composer-input"
        />
        <button
          type="button"
          className="do-collab-composer-send"
          disabled={disabled || sending || !text.trim()}
          onClick={() => void submit()}
          aria-label="Send"
          data-testid="collab-composer-send"
        >
          <Send size={16} />
        </button>
      </div>
      <p className="do-collab-composer-hint">Enter to send · Shift+Enter for newline</p>
    </div>
  );
}

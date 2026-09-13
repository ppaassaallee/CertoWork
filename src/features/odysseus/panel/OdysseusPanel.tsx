import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckSquare,
  Maximize2,
  Mic,
  Minimize2,
  Paperclip,
  RefreshCw,
  Sparkles,
  X,
} from "../../../components/ui/Icon";
import { OdysseusMark } from "../../../components/odiseus/OdysseusMark";
import { useRoutineHost } from "../../../components/routines/RoutineHost";
import { getLocale } from "../../../lib/i18n";
import { sendBoldiChat } from "../../../lib/conversationClient";
import type {
  OdysseusNativeItem,
  OdysseusPanelBlock,
  OdysseusPanelMessage,
  OdysseusPanelScope,
  OdysseusThread,
} from "./types";
import "./odysseusPanel.css";

export type OdysseusPanelProps = {
  open: boolean;
  onClose: () => void;
  scope: OdysseusPanelScope;
  onScopeChange: (scope: OdysseusPanelScope) => void;
  scopeOptions: OdysseusPanelScope[];
  token: string | null;
  userId: string;
  workspaceId: string;
  workspaceContext: Record<string, unknown>;
  onOpenItem: (itemId: string) => void;
  fallbackItems?: OdysseusNativeItem[];
};

function scopeKey(scope: OdysseusPanelScope) {
  return `${scope.kind}:${scope.entityId || "none"}`;
}

function extractBlocks(result: any, fallbackItems?: OdysseusNativeItem[]): OdysseusPanelBlock[] {
  const blocks: OdysseusPanelBlock[] = [];
  if (Array.isArray(result?.blocks)) {
    for (const block of result.blocks) {
      if (block?.type === "items" && Array.isArray(block.items)) {
        blocks.push({
          type: "items",
          items: block.items.map((item: any) => ({
            id: String(item.id),
            title: String(item.title || item.name || "Item"),
            status: item.status || null,
            dueDate: item.dueDate || null,
            workItemType: item.workItemType || null,
            projectTitle: item.projectTitle || null,
          })),
        });
      }
      if (block?.type === "table" && Array.isArray(block.rows)) {
        blocks.push({
          type: "table",
          headers: Array.isArray(block.headers) ? block.headers.map(String) : [],
          rows: block.rows.map((row: any) =>
            Array.isArray(row) ? row.map(String) : [String(row)],
          ),
        });
      }
    }
  }
  if (!blocks.length && fallbackItems?.length) {
    const reply = String(result?.reply || "").toLowerCase();
    if (
      /tarea|task|hoy|today|asign|due|venc|ítem|item|trabajo/.test(reply) ||
      result?.run?.toolCount
    ) {
      blocks.push({ type: "items", items: fallbackItems });
    }
  }
  return blocks;
}

function ensureRoutineSuggestion(chips: string[], locale: string, lastAsk: string) {
  const routine =
    locale === "es" ? "↻ Cada mañana" : "↻ Every morning";
  const next = chips.filter(Boolean).slice(0, 2);
  if (!next.some((chip) => chip.includes("↻") || /cada mañana|every morning/i.test(chip))) {
    next.push(routine);
  }
  while (next.length < 3 && lastAsk) {
    if (locale === "es") {
      if (!next.includes("Priorizar")) next.push("Priorizar");
      else if (!next.includes("Resumir")) next.push("Resumir");
      else break;
    } else if (!next.includes("Prioritize")) next.push("Prioritize");
    else if (!next.includes("Summarize")) next.push("Summarize");
    else break;
  }
  return next.slice(0, 3);
}

function dueLabel(due: string | null | undefined, locale: string) {
  if (!due) return null;
  const today = new Date().toISOString().slice(0, 10);
  const day = String(due).slice(0, 10);
  if (day === today) return locale === "es" ? "hoy" : "today";
  if (day < today) return locale === "es" ? "vencido" : "overdue";
  return day.slice(5);
}

export function OdysseusPanel({
  open,
  onClose,
  scope,
  onScopeChange,
  scopeOptions,
  token,
  userId,
  workspaceId,
  workspaceContext,
  onOpenItem,
  fallbackItems = [],
}: OdysseusPanelProps) {
  const locale = getLocale();
  const { openRoutine } = useRoutineHost();
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const [threadMenuOpen, setThreadMenuOpen] = useState(false);
  const [threadsByScope, setThreadsByScope] = useState<Record<string, OdysseusThread[]>>({});
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const key = scopeKey(scope);

  const threads = threadsByScope[key] || [];
  const activeThread =
    threads.find((thread) => thread.id === activeThreadId) || threads[0] || null;

  useEffect(() => {
    if (!open) return;
    setThreadsByScope((current) => {
      if (current[key]?.length) return current;
      const seed: OdysseusThread = {
        id: `thread-${Date.now()}`,
        title: locale === "es" ? "Nuevo hilo" : "New thread",
        tag: "Chat",
        updatedAt: Date.now(),
        messages: [],
      };
      return { ...current, [key]: [seed] };
    });
    setActiveThreadId((current) => current || null);
  }, [key, open, locale]);

  useEffect(() => {
    const list = threadsByScope[key];
    if (list?.length && !list.some((thread) => thread.id === activeThreadId)) {
      setActiveThreadId(list[0].id);
    }
  }, [key, threadsByScope, activeThreadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread?.messages.length, busy]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const updateActiveThread = useCallback(
    (updater: (thread: OdysseusThread) => OdysseusThread) => {
      setThreadsByScope((current) => {
        const list = current[key] || [];
        const targetId = activeThreadId || list[0]?.id;
        return {
          ...current,
          [key]: list.map((thread) =>
            thread.id === targetId ? updater(thread) : thread,
          ),
        };
      });
    },
    [activeThreadId, key],
  );

  const send = async (explicit?: string) => {
    const text = String(explicit || input).trim();
    if (!text || !token || busy) return;
    setInput("");
    setBusy(true);
    const userMessage: OdysseusPanelMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: Date.now(),
    };
    updateActiveThread((thread) => ({
      ...thread,
      updatedAt: Date.now(),
      title: thread.messages.length ? thread.title : text.slice(0, 42),
      messages: [...thread.messages, userMessage],
    }));

    try {
      const history = (activeThread?.messages || [])
        .concat(userMessage)
        .slice(-12)
        .map((message) => ({ role: message.role, content: message.content }));
      const result = await sendBoldiChat({
        token,
        userId,
        workspaceId,
        conversationId: `panel:${key}:${activeThread?.id || "new"}`,
        messages: history,
        surface: "panel",
        workspaceContext: {
          ...workspaceContext,
          surface: "panel",
          scope: {
            entityType: scope.kind === "item" ? "task" : scope.kind,
            entityId: scope.entityId,
            userId,
            locale,
          },
          userId,
          currentUserId: userId,
        },
      });
      const chips = ensureRoutineSuggestion(
        Array.isArray(result.suggestedChips) ? result.suggestedChips.map(String) : [],
        locale,
        text,
      );
      const blocks = extractBlocks(result, fallbackItems);
      const assistant: OdysseusPanelMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: String(result.reply || "").trim() || (locale === "es" ? "Listo." : "Done."),
        blocks,
        suggestions: chips,
        createdAt: Date.now(),
      };
      updateActiveThread((thread) => ({
        ...thread,
        updatedAt: Date.now(),
        messages: [...thread.messages, assistant],
      }));
    } catch (error) {
      const assistant: OdysseusPanelMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content:
          error instanceof Error
            ? error.message
            : locale === "es"
              ? "No pude completar eso."
              : "I could not complete that.",
        suggestions: ensureRoutineSuggestion([], locale, text),
        createdAt: Date.now(),
      };
      updateActiveThread((thread) => ({
        ...thread,
        messages: [...thread.messages, assistant],
      }));
    } finally {
      setBusy(false);
    }
  };

  const openAsRoutine = (phrase: string) => {
    const cleaned = phrase.replace(/^↻\s*/, "").trim();
    const sentence =
      /cada mañana|every morning/i.test(cleaned) && cleaned.length < 24
        ? locale === "es"
          ? "Cada mañana, dame mis tareas de hoy"
          : "Every morning, show my tasks for today"
        : cleaned;
    openRoutine({
      entityType:
        scope.kind === "item"
          ? "task"
          : scope.kind === "project"
            ? "project"
            : "portfolio",
      entityId: scope.entityId,
      entityTitle: scope.label,
      initialSentence: sentence,
    });
  };

  const scopeLabel = useMemo(() => {
    if (scope.kind === "item") return scope.label;
    if (scope.kind === "project") return scope.label;
    if (scope.kind === "day") return locale === "es" ? "Mi día" : "My day";
    return locale === "es" ? "Todo el workspace" : "Whole workspace";
  }, [scope, locale]);

  if (!open) return null;

  return (
    <aside
      aria-label="Odysseus"
      className={`cw-odysseus-panel ${expanded ? "is-expanded" : ""}`}
      data-testid="odysseus-panel"
    >
      <header className="cw-odysseus-panel-head">
        <div className="cw-odysseus-panel-title">
          <Sparkles size={14} />
          <strong>Odysseus</strong>
        </div>
        <div className="cw-odysseus-panel-actions">
          <button
            aria-label={expanded ? "Collapse" : "Expand"}
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button aria-label="Close" onClick={onClose} type="button">
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="cw-odysseus-panel-selectors">
        <div className="cw-odysseus-menu">
          <button
            className="cw-odysseus-chip"
            onClick={() => {
              setScopeMenuOpen((openMenu) => !openMenu);
              setThreadMenuOpen(false);
            }}
            type="button"
          >
            {locale === "es" ? "Contexto:" : "Context:"} {scopeLabel} ▾
          </button>
          {scopeMenuOpen && (
            <div className="cw-odysseus-menu-list">
              {scopeOptions.map((option) => (
                <button
                  key={scopeKey(option)}
                  onClick={() => {
                    onScopeChange(option);
                    setScopeMenuOpen(false);
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="cw-odysseus-menu">
          <button
            className="cw-odysseus-chip"
            onClick={() => {
              setThreadMenuOpen((openMenu) => !openMenu);
              setScopeMenuOpen(false);
            }}
            type="button"
          >
            {locale === "es" ? "Hilos" : "Threads"} {threads.length} ▾
          </button>
          {threadMenuOpen && (
            <div className="cw-odysseus-menu-list">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => {
                    setActiveThreadId(thread.id);
                    setThreadMenuOpen(false);
                  }}
                  type="button"
                >
                  <em>{thread.tag}</em> {thread.title}
                </button>
              ))}
              <button
                onClick={() => {
                  const seed: OdysseusThread = {
                    id: `thread-${Date.now()}`,
                    title: locale === "es" ? "Nuevo hilo" : "New thread",
                    tag: "Chat",
                    updatedAt: Date.now(),
                    messages: [],
                  };
                  setThreadsByScope((current) => ({
                    ...current,
                    [key]: [seed, ...(current[key] || [])],
                  }));
                  setActiveThreadId(seed.id);
                  setThreadMenuOpen(false);
                }}
                type="button"
              >
                + {locale === "es" ? "Nuevo hilo" : "New thread"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="cw-odysseus-panel-body">
        {(activeThread?.messages || []).map((message) => (
          <div className={`cw-odysseus-msg is-${message.role}`} key={message.id}>
            {message.role === "assistant" && (
              <div className="cw-odysseus-msg-avatar">
                <OdysseusMark size="sm" />
              </div>
            )}
            <div className="cw-odysseus-msg-bubble">
              <p>{message.content}</p>
              {message.blocks?.map((block, index) => {
                if (block.type === "items") {
                  return (
                    <ul className="cw-odysseus-items" key={`items-${index}`}>
                      {block.items.map((item) => (
                        <li key={item.id}>
                          <button onClick={() => onOpenItem(item.id)} type="button">
                            <CheckSquare size={14} />
                            <span>{item.title}</span>
                            {dueLabel(item.dueDate, locale) && (
                              <em className="cw-odysseus-due">
                                {dueLabel(item.dueDate, locale)}
                              </em>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  );
                }
                if (block.type === "table") {
                  return (
                    <table className="cw-odysseus-table" key={`table-${index}`}>
                      {block.headers.length > 0 && (
                        <thead>
                          <tr>
                            {block.headers.map((header) => (
                              <th key={header}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {block.rows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              <td key={cellIndex}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                }
                return null;
              })}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="cw-odysseus-suggestions">
                  {message.suggestions.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => {
                        if (chip.includes("↻") || /cada mañana|every morning/i.test(chip)) {
                          const lastUser = [...(activeThread?.messages || [])]
                            .reverse()
                            .find((entry) => entry.role === "user");
                          openAsRoutine(lastUser?.content || chip);
                          return;
                        }
                        void send(chip);
                      }}
                      type="button"
                    >
                      {chip.startsWith("↻") ? (
                        <>
                          <RefreshCw size={12} /> {chip.replace(/^↻\s*/, "")}
                        </>
                      ) : (
                        chip
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="cw-odysseus-msg is-assistant">
            <div className="cw-odysseus-msg-avatar">
              <OdysseusMark size="sm" />
            </div>
            <div className="cw-odysseus-msg-bubble is-working">
              {locale === "es" ? "Consultando…" : "Checking…"}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="cw-odysseus-composer">
        <textarea
          aria-label="Ask Odysseus"
          data-testid="odysseus-panel-composer"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder={locale === "es" ? "Pedile a Odysseus…" : "Ask Odysseus…"}
          rows={2}
          value={input}
        />
        <div className="cw-odysseus-composer-foot">
          <button aria-label="Attach" type="button">
            <Paperclip size={15} />
          </button>
          <button aria-label="Voice" type="button">
            <Mic size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}

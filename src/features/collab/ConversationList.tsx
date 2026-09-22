import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  User,
} from "../../components/ui/Icon";
import type { Conversation, ConversationType } from "../../lib/collab/types";

export type ConversationFilter =
  | "all"
  | "unread"
  | "me"
  | "projects"
  | "direct"
  | "groups"
  | "external"
  | "agents";

const FILTERS: Array<{ id: ConversationFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "me", label: "@Me" },
  { id: "projects", label: "Projects" },
  { id: "direct", label: "Direct" },
  { id: "groups", label: "Groups" },
  { id: "external", label: "External" },
  { id: "agents", label: "Agents" },
];

type SectionId =
  | "unread"
  | "pinned"
  | "projects"
  | "direct"
  | "groups"
  | "external"
  | "agents"
  | "odysseus";

const SECTION_META: Array<{ id: SectionId; label: string }> = [
  { id: "unread", label: "Unread" },
  { id: "pinned", label: "Pinned" },
  { id: "projects", label: "Projects" },
  { id: "direct", label: "Direct" },
  { id: "groups", label: "Groups" },
  { id: "external", label: "External" },
  { id: "agents", label: "Agent rooms" },
  { id: "odysseus", label: "Odysseus" },
];

function typeToSection(type: ConversationType): SectionId | null {
  switch (type) {
    case "project_room":
    case "item_thread":
    case "record_thread":
      return "projects";
    case "dm":
      return "direct";
    case "group":
      return "groups";
    case "external":
      return "external";
    case "agent_room":
      return "agents";
    default:
      return null;
  }
}

function matchesFilter(
  c: Conversation,
  filter: ConversationFilter,
  userId?: string,
): boolean {
  if (filter === "all") return true;
  if (filter === "unread") {
    // Heuristic until participant unreadCount is subscribed on the list.
    return Boolean(c.lastMessageAt) && c.lastMessageBy !== userId;
  }
  if (filter === "me") {
    const hay = `${c.lastMessagePreview || ""} ${c.title}`.toLowerCase();
    return Boolean(userId && hay.includes(`@${userId.toLowerCase()}`)) || hay.includes("@me");
  }
  if (filter === "projects")
    return c.type === "project_room" || c.type === "item_thread" || c.type === "record_thread";
  if (filter === "direct") return c.type === "dm";
  if (filter === "groups") return c.type === "group";
  if (filter === "external") return c.type === "external";
  if (filter === "agents") return c.type === "agent_room";
  return true;
}

function formatPreviewTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

type Props = {
  conversations: Conversation[];
  loading?: boolean;
  selectedId: string | null;
  /** Special selection for Odysseus stub row */
  odysseusSelected?: boolean;
  userId?: string;
  onSelect: (conversationId: string) => void;
  onSelectOdysseus: () => void;
  onRefresh?: () => void;
  onNewGroup?: () => void;
  onNewDm?: () => void;
  onOpenProjectRoom?: () => void;
  onInviteExternal?: () => void;
};

export function ConversationList({
  conversations,
  loading,
  selectedId,
  odysseusSelected,
  userId,
  onSelect,
  onSelectOdysseus,
  onRefresh,
  onNewGroup,
  onNewDm,
  onOpenProjectRoom,
  onInviteExternal,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [newOpen, setNewOpen] = useState(false);
  const newRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!newOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!newRef.current?.contains(e.target as Node)) setNewOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [newOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (!matchesFilter(c, filter, userId)) return false;
      if (!q) return true;
      const hay = `${c.title} ${c.lastMessagePreview || ""} ${c.anchor?.label || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, filter, query, userId]);

  const bySection = useMemo(() => {
    const map: Record<SectionId, Conversation[]> = {
      unread: [],
      pinned: [],
      projects: [],
      direct: [],
      groups: [],
      external: [],
      agents: [],
      odysseus: [],
    };
    for (const c of filtered) {
      const section = typeToSection(c.type);
      if (section) map[section].push(c);
    }
    return map;
  }, [filtered]);

  return (
    <aside className="do-collab-list" aria-label="Conversations" data-testid="collab-conversation-list">
      <header className="do-collab-list-header">
        <div className="do-collab-list-title-row">
          <h1>Collab</h1>
          <div className="do-collab-list-header-actions" ref={newRef}>
            {onRefresh ? (
              <button
                type="button"
                className="do-collab-icon-btn"
                onClick={onRefresh}
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            ) : null}
            <button
              type="button"
              className="do-collab-btn-primary do-collab-new-btn"
              onClick={() => setNewOpen((o) => !o)}
              aria-expanded={newOpen}
              data-testid="collab-new-btn"
            >
              <Plus size={14} />
              New
              <ChevronDown size={12} />
            </button>
            {newOpen ? (
              <div className="do-collab-new-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  disabled={!onNewDm}
                  onClick={() => {
                    setNewOpen(false);
                    onNewDm?.();
                  }}
                >
                  Message a person
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!onNewGroup}
                  onClick={() => {
                    setNewOpen(false);
                    onNewGroup?.();
                  }}
                >
                  New group
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!onInviteExternal}
                  onClick={() => {
                    setNewOpen(false);
                    onInviteExternal?.();
                  }}
                >
                  New external thread
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!onOpenProjectRoom}
                  onClick={() => {
                    setNewOpen(false);
                    onOpenProjectRoom?.();
                  }}
                >
                  Open project room
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <label className="do-collab-search">
          <Search size={14} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            data-testid="collab-search"
          />
        </label>
        <div className="do-collab-filters" role="tablist" aria-label="Filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`do-collab-chip${filter === f.id ? " is-active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="do-collab-list-scroll">
        {loading ? <p className="do-collab-list-status">Loading…</p> : null}
        {!loading && filtered.length === 0 ? (
          <p className="do-collab-list-status">No conversations yet.</p>
        ) : null}

        {SECTION_META.map((section) => {
          if (section.id === "odysseus") {
            return (
              <section key={section.id} className="do-collab-section">
                <h2 className="do-collab-section-label">{section.label}</h2>
                <button
                  type="button"
                  className={`do-collab-conv-row${odysseusSelected ? " is-selected" : ""}`}
                  onClick={onSelectOdysseus}
                  data-testid="collab-odysseus-row"
                >
                  <span className="do-collab-conv-avatar do-collab-conv-avatar--odysseus">
                    <Bot size={16} />
                  </span>
                  <span className="do-collab-conv-body">
                    <span className="do-collab-conv-title">Odysseus</span>
                    <span className="do-collab-conv-preview">Opens existing Odysseus chat</span>
                  </span>
                </button>
              </section>
            );
          }

          const items = bySection[section.id];
          if (!items.length) return null;

          return (
            <section key={section.id} className="do-collab-section">
              <h2 className="do-collab-section-label">{section.label}</h2>
              <ul className="do-collab-conv-ul">
                {items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`do-collab-conv-row${selectedId === c.id && !odysseusSelected ? " is-selected" : ""}`}
                      onClick={() => onSelect(c.id)}
                      data-testid={`collab-conv-${c.id}`}
                    >
                      <span className="do-collab-conv-avatar">
                        {c.type === "agent_room" ? (
                          <Bot size={16} />
                        ) : c.type === "dm" ? (
                          <User size={16} />
                        ) : (
                          <MessageSquare size={16} />
                        )}
                      </span>
                      <span className="do-collab-conv-body">
                        <span className="do-collab-conv-title-row">
                          <span className="do-collab-conv-title">{c.emoji ? `${c.emoji} ` : ""}{c.title}</span>
                          <span className="do-collab-conv-time">{formatPreviewTime(c.lastMessageAt)}</span>
                        </span>
                        <span className="do-collab-conv-preview">
                          {c.lastMessagePreview || c.description || "No messages yet"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </aside>
  );
}

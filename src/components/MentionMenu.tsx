import { useMemo, useState } from "react";
import { memberPublicLabel, type WorkspaceMember } from "../lib/workspaceCollaboration";

export type MentionOption = {
  id: string;
  label: string;
  kind: "person" | "item" | "doc" | "project" | "team";
  meta?: string;
};

export function MentionMenu({
  open,
  query,
  options,
  onSelect,
  onClose,
}: {
  open: boolean;
  query: string;
  options: MentionOption[];
  onSelect: (option: MentionOption) => void;
  onClose: () => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 12);
    return options
      .filter(
        (option) =>
          option.label.toLowerCase().includes(q) ||
          option.meta?.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [options, query]);

  if (!open) return null;

  return (
    <div className="cw-slash-menu" data-testid="mention-menu">
      <div className="cw-slash-list">
        {filtered.map((option) => (
          <button key={`${option.kind}-${option.id}`} onClick={() => onSelect(option)} type="button">
            <span className="cw-semantic-chip" data-hue="blue">
              {option.kind}
            </span>{" "}
            {option.label}
            {option.meta ? <em style={{ color: "var(--text-muted)", marginLeft: 6 }}>{option.meta}</em> : null}
          </button>
        ))}
        {!filtered.length && (
          <button onClick={onClose} type="button">
            —
          </button>
        )}
      </div>
    </div>
  );
}

export function mentionOptionsFromMembers(members: WorkspaceMember[]): MentionOption[] {
  return members.map((member) => ({
    id: String(member.id),
    label: memberPublicLabel(member),
    kind: "person" as const,
  }));
}

export function useMentionQuery(text: string) {
  const match = String(text || "").match(/(?:^|\s)@([\w.-]*)$/);
  const [forced, setForced] = useState(false);
  return {
    open: Boolean(match) || forced,
    query: match?.[1] || "",
    setForced,
  };
}

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Info, Users } from "./ui/Icon";
import {
  DEFAULT_MEMBER_EMOJI,
  MEMBER_EMOJI_CHOICES,
  isAssignableMember,
  memberAssignmentValue,
  memberAvatar,
  memberMatchesSelection,
  memberPublicLabel,
  type WorkspaceMember,
} from "../lib/workspaceCollaboration";

export type AssignableMember = Pick<
  WorkspaceMember,
  "id" | "userId" | "alias" | "emoji" | "displayName" | "email" | "emailLower" | "status"
>;

export function memberName(member: AssignableMember) {
  return memberPublicLabel(member);
}

let closeOpenInfoTip: (() => void) | null = null;

export function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    if (closeOpenInfoTip && closeOpenInfoTip !== close) closeOpenInfoTip();
    closeOpenInfoTip = close;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 260;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const top = Math.min(rect.bottom + 8, window.innerHeight - 120);
      setStyle({ position: "fixed", top, left, width, zIndex: 280 });
    };
    place();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || bubbleRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      if (closeOpenInfoTip === close) closeOpenInfoTip = null;
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        aria-expanded={open}
        aria-label={label}
        className={`cw-info-tip${open ? " is-open" : ""}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        ref={triggerRef}
        type="button"
      >
        <Info size={12} />
      </button>
      {open &&
        createPortal(
          <div className="cw-info-tip-bubble" ref={bubbleRef} role="tooltip" style={style}>
            <strong>{label}</strong>
            <p>{text}</p>
          </div>,
          document.body,
        )}
    </>
  );
}

export function AliasProfileEditor({
  alias,
  emoji,
  onAliasChange,
  onEmojiChange,
}: {
  alias: string;
  emoji: string;
  onAliasChange: (value: string) => void;
  onEmojiChange: (value: string) => void;
}) {
  return (
    <div className="cw-alias-editor">
      <label>
        Alias
        <input
          maxLength={32}
          onChange={(event) => onAliasChange(event.target.value)}
          placeholder="How teammates should see you"
          value={alias}
        />
      </label>
      <div>
        <span>Icon</span>
        <div className="cw-emoji-choices">
          {MEMBER_EMOJI_CHOICES.map((choice) => (
            <button
              className={emoji === choice ? "is-selected" : ""}
              key={choice}
              onClick={() => onEmojiChange(choice)}
              type="button"
            >
              {choice}
            </button>
          ))}
          <input
            aria-label="Custom emoji"
            maxLength={8}
            onChange={(event) => onEmojiChange(event.target.value || DEFAULT_MEMBER_EMOJI)}
            placeholder="+"
            value={MEMBER_EMOJI_CHOICES.includes(emoji) ? "" : emoji}
          />
        </div>
      </div>
    </div>
  );
}

export function MultiAssigneePicker({
  members,
  selectedIds = [],
  selectedNames = [],
  onChange,
  onInviteEmail,
  label = "Assignees",
  compact = false,
  triggerTestId,
}: {
  members: AssignableMember[];
  selectedIds?: string[];
  selectedNames?: string[];
  onChange: (ids: string[], names: string[]) => void;
  onInviteEmail?: (email: string) => Promise<void> | void;
  label?: string;
  compact?: boolean;
  triggerTestId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const activeMembers = useMemo(
    () => members.filter((member) => isAssignableMember(member)),
    [members],
  );
  const selected = activeMembers.filter((member) =>
    memberMatchesSelection(member, selectedIds, selectedNames),
  );
  const orphanNames = useMemo(() => {
    return selectedNames
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .filter(
        (name) =>
          !activeMembers.some((member) => memberMatchesSelection(member, [], [name])),
      );
  }, [selectedNames, activeMembers]);

  const placeMenu = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 300;
    const gap = 6;
    const measured = menuRef.current?.offsetHeight;
    const estimated =
      measured ||
      Math.min(320, 120 + activeMembers.length * 44 + (onInviteEmail ? 72 : 0) + (orphanNames.length ? 48 : 0));
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < Math.min(estimated, 240) && spaceAbove > spaceBelow;
    const available = Math.max(140, openUp ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(320, available);
    let left = Math.min(rect.right - width, window.innerWidth - width - 8);
    if (left < 8) left = 8;
    const top = openUp
      ? Math.max(8, rect.top - Math.min(estimated, maxHeight) - gap)
      : Math.min(rect.bottom + gap, window.innerHeight - maxHeight - 8);
    setMenuStyle({
      position: "fixed",
      top,
      left,
      width,
      maxHeight,
      overflowY: "auto",
      zIndex: 260,
    });
  };

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const frame = window.requestAnimationFrame(() => placeMenu());
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onReposition = () => placeMenu();
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, activeMembers.length, onInviteEmail, orphanNames.length]);

  const toggle = (member: AssignableMember) => {
    const isSelected = selected.some((candidate) => candidate.id === member.id);
    const next = isSelected
      ? selected.filter((candidate) => candidate.id !== member.id)
      : [...selected, member];
    onChange(
      next.map((candidate) => candidate.id),
      next.map((candidate) => memberAssignmentValue(candidate)),
    );
  };

  const submitInvite = async () => {
    if (!onInviteEmail || inviteBusy) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email.includes("@")) return;
    setInviteBusy(true);
    try {
      await onInviteEmail(email);
      setInviteEmail("");
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <div className="cw-multi-assignee">
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${label}: ${selected.length} selected`}
        className={`cw-multi-assignee-trigger${compact ? " is-avatars" : ""}`}
        data-testid={triggerTestId}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        ref={triggerRef}
        type="button"
      >
        {compact ? (
          selected.length ? (
            selected.slice(0, 3).map((member) => (
              <em aria-hidden="true" key={member.id}>{memberAvatar(member)}</em>
            ))
          ) : (
            <Users size={13} />
          )
        ) : (
          <>
            <Users size={12} />
            <span>
              {selected.length
                ? selected
                    .slice(0, 2)
                    .map((member) => `${memberAvatar(member)} ${memberName(member)}`)
                    .join(", ")
                : orphanNames.length
                  ? orphanNames.slice(0, 2).join(", ")
                : "Unassigned"}
              {selected.length > 2 ? ` +${selected.length - 2}` : ""}
            </span>
          </>
        )}
      </button>
      {open &&
        createPortal(
          <div className="cw-multi-assignee-menu" ref={menuRef} style={menuStyle}>
            <header>
              <strong>{label}</strong>
              <small>Pick workspace members. Typing a name elsewhere does not send an invite email.</small>
            </header>
            {orphanNames.length > 0 && (
              <p className="cw-multi-assignee-orphan">
                Not invited yet: {orphanNames.join(", ")}. Invite them below or from Workspace &amp; team.
              </p>
            )}
            {activeMembers.map((member) => {
              const checked = selected.some((candidate) => candidate.id === member.id);
              return (
                <label key={member.id}>
                  <input checked={checked} onChange={() => toggle(member)} type="checkbox" />
                  <em aria-hidden="true">{memberAvatar(member)}</em>
                  <span>
                    <strong>{memberName(member)}</strong>
                    <small>{String(member.status || "active") === "invited" ? "Invite pending — email sent/queued" : "Workspace member"}</small>
                  </span>
                </label>
              );
            })}
            {activeMembers.length === 0 && (
              <p>No members yet. Invite by email first — assigning a plain name never emails them.</p>
            )}
            {onInviteEmail && (
              <div className="cw-multi-assignee-invite">
                <input
                  aria-label="Invite assignee by email"
                  onChange={(event) => setInviteEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submitInvite();
                    }
                  }}
                  placeholder="Invite by email…"
                  type="email"
                  value={inviteEmail}
                />
                <button
                  disabled={inviteBusy || !inviteEmail.includes("@")}
                  onClick={() => void submitInvite()}
                  type="button"
                >
                  {inviteBusy ? "Inviting…" : "Invite"}
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

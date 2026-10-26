import { useMemo, useState } from "react";
import { Users } from "../../../components/ui/Icon";
import {
  collaborationShareGrant,
  shareableEmail,
  withCollaboratorAccess,
} from "../../../lib/collaborationAccess";
import { isSpanish } from "../../../lib/i18n";
import { memberPublicLabel } from "../../../lib/workspaceCollaboration";

type ShareMember = {
  id: string;
  displayName?: string;
  email?: string;
  emailLower?: string;
  status?: string;
  userId?: string;
  publicAlias?: string;
};

export function ItemShareControl({
  item,
  locale,
  members,
  onUpdateTask,
}: {
  item: Record<string, unknown> & {
    id: string;
    sharedWithUserIds?: unknown;
    visibleToEmails?: unknown;
    visibleToUserIds?: unknown;
  };
  locale: string;
  members: ShareMember[];
  onUpdateTask: (taskId: string, patch: Record<string, unknown>) => Promise<void> | void;
}) {
  const [memberId, setMemberId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const shareable = useMemo(
    () => members.filter((member) => {
      const status = String(member.status || "active").toLowerCase();
      return !["removed", "rejected", "revoked"].includes(status) &&
        Boolean(member.userId || member.email || member.emailLower);
    }),
    [members],
  );
  const sharedNames = useMemo(() => {
    const userIds = new Set([
      ...(Array.isArray(item.visibleToUserIds) ? item.visibleToUserIds : []),
      ...(Array.isArray(item.sharedWithUserIds) ? item.sharedWithUserIds : []),
    ].map(String));
    const emails = new Set(
      (Array.isArray(item.visibleToEmails) ? item.visibleToEmails : [])
        .map((value: unknown) => String(value || "").trim().toLowerCase()),
    );
    return shareable
      .filter((member) =>
        (member.userId && userIds.has(String(member.userId))) || emails.has(shareableEmail(member)),
      )
      .map((member) => memberPublicLabel(member));
  }, [item.sharedWithUserIds, item.visibleToEmails, item.visibleToUserIds, shareable]);

  const share = async () => {
    const member = shareable.find((entry) => entry.id === memberId);
    if (!member) return;
    setBusy(true);
    setNotice("");
    try {
      await onUpdateTask(item.id, withCollaboratorAccess(item, collaborationShareGrant(member)));
      setNotice(isSpanish(locale)
        ? `Acceso otorgado a ${memberPublicLabel(member)}.`
        : `Access granted to ${memberPublicLabel(member)}.`);
      setMemberId("");
    } catch {
      setNotice(isSpanish(locale)
        ? "No se pudo compartir este item. Intenta de nuevo."
        : "This item could not be shared. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cw-item-share-control">
      <div className="cw-item-share-picker">
        <Users aria-hidden="true" size={14} />
        <select aria-label={isSpanish(locale) ? "Compartir item con" : "Share item with"} onChange={(event) => {
          setNotice("");
          setMemberId(event.target.value);
        }} value={memberId}>
          <option value="">{isSpanish(locale) ? "Seleccionar persona…" : "Select a person…"}</option>
          {shareable.map((member) => <option key={member.id} value={member.id}>{memberPublicLabel(member)}</option>)}
        </select>
        <button disabled={!memberId || busy} onClick={() => void share()} type="button">
          {busy ? (isSpanish(locale) ? "Compartiendo…" : "Sharing…") : (isSpanish(locale) ? "Dar acceso" : "Grant access")}
        </button>
      </div>
      {sharedNames.length ? <small title={sharedNames.join(", ")}>
        {isSpanish(locale) ? "Compartido con" : "Shared with"}: {sharedNames.join(", ")}
      </small> : null}
      {notice ? <small className="cw-item-share-notice" role="status">{notice}</small> : null}
    </div>
  );
}

import { useMemo, useState } from "react";
import { DAvatar, DButton, DPill, DSheet, DTable } from "../../desktop/ui";
import "../../desktop/ui/desktop-ui.css";

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt?: string;
  status?: "Online" | "Idle" | "Offline" | string;
};

export function MembersAdminPage({
  members,
  inviteLink,
  onInviteEmail,
  onChangeRole,
  pageSize = 25,
}: {
  members: MemberRow[];
  inviteLink?: string;
  onInviteEmail?: (email: string) => Promise<void> | void;
  onChangeRole?: (id: string, role: string) => Promise<void> | void;
  pageSize?: number;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manage, setManage] = useState<MemberRow | null>(null);
  const [email, setEmail] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(s) || m.email.toLowerCase().includes(s) || m.role.toLowerCase().includes(s),
    );
  }, [members, q]);

  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));

  return (
    <div className="d-root" data-testid="admin-members" style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Members</h1>
      <section
        style={{
          background: "#fff",
          border: "1px solid var(--c-line)",
          borderRadius: 14,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Add new team</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            readOnly
            style={{ flex: 1, minWidth: 200, border: "1px solid var(--c-line)", borderRadius: 10, padding: "8px 10px" }}
            value={inviteLink || "Invite link not configured"}
          />
          <DButton
            onClick={() => inviteLink && navigator.clipboard?.writeText(inviteLink)}
            variant="secondary"
          >
            Copy link
          </DButton>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            aria-label="Invite email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@company.com"
            style={{ flex: 1, border: "1px solid var(--c-line)", borderRadius: 10, padding: "8px 10px" }}
            value={email}
          />
          <DButton
            onClick={async () => {
              if (!email.trim()) return;
              if (onInviteEmail) await onInviteEmail(email.trim());
              else if (inviteLink) await navigator.clipboard?.writeText(inviteLink);
              setEmail("");
            }}
          >
            Send invite
          </DButton>
        </div>
      </section>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          aria-label="Search members"
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="Search…"
          style={{ border: "1px solid var(--c-line)", borderRadius: 10, padding: "8px 10px", minWidth: 220 }}
          value={q}
        />
      </div>

      <DTable
        columns={[
          { id: "name", label: "Name" },
          { id: "email", label: "Email" },
          { id: "role", label: "Role" },
          { id: "joined", label: "Joined" },
          { id: "status", label: "Status" },
          { id: "manage", label: "" },
        ]}
        onToggle={(id) => {
          setSelected((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
          });
        }}
        rows={pageRows.map((m) => ({
          id: m.id,
          cells: {
            name: (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <DAvatar label={m.name} />
                {m.name}
              </span>
            ),
            email: m.email,
            role: m.role.toLowerCase() === "admin" ? <DPill tone="ok">Admin</DPill> : m.role,
            joined: m.joinedAt || "—",
            status: m.status || "Offline",
            manage: (
              <DButton onClick={() => setManage(m)} size="sm" variant="ghost">
                Manage
              </DButton>
            ),
          },
        }))}
        selected={selected}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
        <DButton disabled={page <= 0} onClick={() => setPage((p) => p - 1)} size="sm" variant="secondary">
          Prev
        </DButton>
        <span style={{ fontSize: 13, color: "var(--c-ink-2)" }}>
          Page {page + 1} / {pages}
        </span>
        <DButton
          disabled={page + 1 >= pages}
          onClick={() => setPage((p) => p + 1)}
          size="sm"
          variant="secondary"
        >
          Next
        </DButton>
      </div>

      <DSheet onClose={() => setManage(null)} open={!!manage} title={manage?.name || "Member"}>
        {manage ? (
          <div>
            <p>{manage.email}</p>
            <label style={{ display: "block", marginTop: 12, fontSize: 12, color: "var(--c-ink-2)" }}>
              Role
              <select
                defaultValue={manage.role}
                onChange={(e) => void onChangeRole?.(manage.id, e.target.value)}
                style={{ display: "block", width: "100%", marginTop: 6, padding: 8, borderRadius: 10 }}
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
          </div>
        ) : null}
      </DSheet>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import { mcpTokenText } from "../../lib/mcpTokenCopy";
import { DestructiveDialog } from "../ui/DestructiveDialog";

type ApiTokenRow = {
  id: string;
  name: string;
  tokenPrefix: string;
  workspaceIds: string[];
  permission: "read" | "read-write";
  assign: boolean;
  canDelete?: boolean;
  admin?: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string | null;
};

const DAY_CHOICES = [30, 90, 365];

function tokenState(row: ApiTokenRow) {
  if (row.revokedAt) return mcpTokenText("revoked");
  if (row.expiresAt && Date.parse(row.expiresAt) <= Date.now()) return mcpTokenText("expired");
  return mcpTokenText("active");
}

export function ApiTokensPanel() {
  const { user, workspace, workspaces } = useAuth();
  const [rows, setRows] = useState<ApiTokenRow[]>([]);
  const [name, setName] = useState("");
  const [permission, setPermission] = useState<"read" | "read-write">("read");
  const [assign, setAssign] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [selected, setSelected] = useState<string[]>([]);
  const [secret, setSecret] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const endpoint = `${window.location.origin}/mcp`;

  useEffect(() => {
    if (workspace?.id) setSelected((current) => (current.length ? current : [workspace.id]));
  }, [workspace?.id]);

  const load = async () => {
    if (!user) return;
    const idToken = await user.getIdToken();
    const response = await fetch("/api/mcp/tokens", {
      headers: { authorization: `Bearer ${idToken}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(String(payload.message || payload.error || "Could not load API tokens."));
      return;
    }
    setRows(Array.isArray(payload.tokens) ? payload.tokens : []);
  };

  useEffect(() => {
    void load();
  }, [user]);

  const toggleWorkspace = (workspaceId: string) => {
    setSelected((current) =>
      current.includes(workspaceId) ? current.filter((id) => id !== workspaceId) : [...current, workspaceId],
    );
  };

  const createToken = async () => {
    if (!user) return;
    if (!selected.length) {
      setNotice(mcpTokenText("needWorkspace"));
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: {
          authorization: `Bearer ${idToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name,
          workspaceIds: selected,
          permission,
          assign: permission === "read-write" && assign,
          canDelete: permission === "read-write" && canDelete,
          admin: permission === "read-write" && admin,
          expiresInDays,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(String(payload.message || "Could not create the token."));
        return;
      }
      setSecret(String(payload.token || ""));
      setName("");
      setAssign(false);
      setCanDelete(false);
      setAdmin(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!user || !revokeId) return;
    const idToken = await user.getIdToken();
    const response = await fetch(`/api/mcp/tokens/${encodeURIComponent(revokeId)}/revoke`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${idToken}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setNotice(String(payload.message || "Could not revoke the token."));
    setRevokeId(null);
    await load();
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setNotice(mcpTokenText("copied"));
    } catch {
      setNotice(secret);
    }
  };

  const choices = workspaces.length ? workspaces : workspace ? [workspace] : [];

  return (
    <section className="mcp-tokens" data-testid="mcp-api-tokens">
      <header className="mcp-tokens-head">
        <h2>{mcpTokenText("title")}</h2>
        <p>{mcpTokenText("subtitle")}</p>
      </header>

      <div className="mcp-tokens-connect">
        <strong>{mcpTokenText("connectTitle")}</strong>
        <p>{mcpTokenText("connectBody").replace("{url}", endpoint)}</p>
        <code data-testid="mcp-endpoint">{endpoint}</code>
      </div>

      {secret ? (
        <div className="mcp-tokens-secret" data-testid="mcp-token-secret">
          <p>{mcpTokenText("once")}</p>
          <code>{secret}</code>
          <button onClick={() => void copySecret()} type="button">{mcpTokenText("copy")}</button>
        </div>
      ) : null}

      <form
        className="mcp-tokens-form"
        onSubmit={(event) => {
          event.preventDefault();
          void createToken();
        }}
      >
        <label>
          <span>{mcpTokenText("name")}</span>
          <input
            data-testid="mcp-token-name"
            maxLength={80}
            type="text"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <fieldset>
          <legend>{mcpTokenText("permission")}</legend>
          <label>
            <input
              checked={permission === "read"}
              name="mcp-permission"
              onChange={() => {
                setPermission("read");
                setAssign(false);
                setCanDelete(false);
                setAdmin(false);
              }}
              type="radio"
            />
            {mcpTokenText("read")}
          </label>
          <label>
            <input
              checked={permission === "read-write"}
              data-testid="mcp-token-write"
              name="mcp-permission"
              onChange={() => setPermission("read-write")}
              type="radio"
            />
            {mcpTokenText("readWrite")}
          </label>
        </fieldset>
        <label className="mcp-tokens-check">
          <input
            checked={assign}
            data-testid="mcp-token-assign"
            disabled={permission !== "read-write"}
            onChange={(event) => setAssign(event.target.checked)}
            type="checkbox"
          />
          <span>
            {mcpTokenText("assign")}
            <small>{mcpTokenText("assignHint")}</small>
          </span>
        </label>
        <label className="mcp-tokens-check">
          <input
            checked={canDelete}
            data-testid="mcp-token-delete"
            disabled={permission !== "read-write"}
            onChange={(event) => setCanDelete(event.target.checked)}
            type="checkbox"
          />
          <span>
            {mcpTokenText("delete")}
            <small>{mcpTokenText("deleteHint")}</small>
          </span>
        </label>
        <label className="mcp-tokens-check">
          <input
            checked={admin}
            data-testid="mcp-token-admin"
            disabled={permission !== "read-write"}
            onChange={(event) => setAdmin(event.target.checked)}
            type="checkbox"
          />
          <span>
            {mcpTokenText("admin")}
            <small>{mcpTokenText("adminHint")}</small>
          </span>
        </label>
        <fieldset>
          <legend>{mcpTokenText("expires")}</legend>
          {DAY_CHOICES.map((days) => (
            <label key={days}>
              <input
                checked={expiresInDays === days}
                name="mcp-expiry"
                onChange={() => setExpiresInDays(days)}
                type="radio"
              />
              {mcpTokenText("days").replace("{n}", String(days))}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{mcpTokenText("workspaces")}</legend>
          {choices.map((item) => (
            <label key={item.id}>
              <input
                checked={selected.includes(item.id)}
                onChange={() => toggleWorkspace(item.id)}
                type="checkbox"
              />
              {item.name || item.id}
            </label>
          ))}
        </fieldset>
        <button data-testid="mcp-token-create" disabled={busy || !name.trim()} type="submit">
          {mcpTokenText("create")}
        </button>
        {notice ? <p className="mcp-tokens-notice" role="status">{notice}</p> : null}
      </form>

      <ul className="mcp-tokens-list" data-testid="mcp-token-list">
        {rows.length === 0 ? <li className="mcp-tokens-empty">{mcpTokenText("empty")}</li> : null}
        {rows.map((row) => (
          <li key={row.id}>
            <div>
              <strong>{row.name}</strong>
              <span>{row.tokenPrefix}…</span>
              <span>
                {row.permission}
                {row.assign ? " · assign" : ""}
                {row.canDelete ? " · delete" : ""}
                {row.admin ? " · admin" : ""}
              </span>
              <span>{tokenState(row)}</span>
            </div>
            {!row.revokedAt ? (
              <button onClick={() => setRevokeId(row.id)} type="button">{mcpTokenText("revoke")}</button>
            ) : null}
          </li>
        ))}
      </ul>

      <DestructiveDialog
        confirmLabel={mcpTokenText("revoke")}
        entityName={rows.find((row) => row.id === revokeId)?.name || mcpTokenText("title")}
        impact={[mcpTokenText("confirmRevoke")]}
        onCancel={() => setRevokeId(null)}
        onConfirm={() => void revoke()}
        open={Boolean(revokeId)}
        verb={mcpTokenText("revoke")}
      />
    </section>
  );
}

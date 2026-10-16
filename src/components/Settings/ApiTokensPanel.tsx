import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import { t } from "../../lib/i18n";
import { DestructiveDialog } from "../ui/DestructiveDialog";

type ApiTokenRow = {
  id: string;
  name: string;
  tokenPrefix: string;
  workspaceIds: string[];
  permission: "read" | "read-write";
  assign: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string | null;
};

const DAY_CHOICES = [30, 90, 365];

function tokenState(row: ApiTokenRow) {
  if (row.revokedAt) return t("mcp.tokens.revoked");
  if (row.expiresAt && Date.parse(row.expiresAt) <= Date.now()) return t("mcp.tokens.expired");
  return t("mcp.tokens.active");
}

export function ApiTokensPanel() {
  const { user, workspace, workspaces } = useAuth();
  const [rows, setRows] = useState<ApiTokenRow[]>([]);
  const [name, setName] = useState("");
  const [permission, setPermission] = useState<"read" | "read-write">("read");
  const [assign, setAssign] = useState(false);
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
      setNotice(t("mcp.tokens.needWorkspace"));
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
      setNotice(t("mcp.tokens.copied"));
    } catch {
      setNotice(secret);
    }
  };

  const choices = workspaces.length ? workspaces : workspace ? [workspace] : [];

  return (
    <section className="mcp-tokens" data-testid="mcp-api-tokens">
      <header className="mcp-tokens-head">
        <h2>{t("mcp.tokens.title")}</h2>
        <p>{t("mcp.tokens.subtitle")}</p>
      </header>

      <div className="mcp-tokens-connect">
        <strong>{t("mcp.tokens.connectTitle")}</strong>
        <p>{t("mcp.tokens.connectBody").replace("{url}", endpoint)}</p>
        <code data-testid="mcp-endpoint">{endpoint}</code>
      </div>

      {secret ? (
        <div className="mcp-tokens-secret" data-testid="mcp-token-secret">
          <p>{t("mcp.tokens.once")}</p>
          <code>{secret}</code>
          <button onClick={() => void copySecret()} type="button">{t("mcp.tokens.copy")}</button>
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
          <span>{t("mcp.tokens.name")}</span>
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
          <legend>{t("mcp.tokens.permission")}</legend>
          <label>
            <input
              checked={permission === "read"}
              name="mcp-permission"
              onChange={() => {
                setPermission("read");
                setAssign(false);
              }}
              type="radio"
            />
            {t("mcp.tokens.read")}
          </label>
          <label>
            <input
              checked={permission === "read-write"}
              data-testid="mcp-token-write"
              name="mcp-permission"
              onChange={() => setPermission("read-write")}
              type="radio"
            />
            {t("mcp.tokens.readWrite")}
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
            {t("mcp.tokens.assign")}
            <small>{t("mcp.tokens.assignHint")}</small>
          </span>
        </label>
        <fieldset>
          <legend>{t("mcp.tokens.expires")}</legend>
          {DAY_CHOICES.map((days) => (
            <label key={days}>
              <input
                checked={expiresInDays === days}
                name="mcp-expiry"
                onChange={() => setExpiresInDays(days)}
                type="radio"
              />
              {t("mcp.tokens.days").replace("{n}", String(days))}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{t("mcp.tokens.workspaces")}</legend>
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
          {t("mcp.tokens.create")}
        </button>
        {notice ? <p className="mcp-tokens-notice" role="status">{notice}</p> : null}
      </form>

      <ul className="mcp-tokens-list" data-testid="mcp-token-list">
        {rows.length === 0 ? <li className="mcp-tokens-empty">{t("mcp.tokens.empty")}</li> : null}
        {rows.map((row) => (
          <li key={row.id}>
            <div>
              <strong>{row.name}</strong>
              <span>{row.tokenPrefix}…</span>
              <span>{row.permission}{row.assign ? " · assign" : ""}</span>
              <span>{tokenState(row)}</span>
            </div>
            {!row.revokedAt ? (
              <button onClick={() => setRevokeId(row.id)} type="button">{t("mcp.tokens.revoke")}</button>
            ) : null}
          </li>
        ))}
      </ul>

      <DestructiveDialog
        confirmLabel={t("mcp.tokens.revoke")}
        entityName={rows.find((row) => row.id === revokeId)?.name || t("mcp.tokens.title")}
        impact={[t("mcp.tokens.confirmRevoke")]}
        onCancel={() => setRevokeId(null)}
        onConfirm={() => void revoke()}
        open={Boolean(revokeId)}
        verb={t("mcp.tokens.revoke")}
      />
    </section>
  );
}

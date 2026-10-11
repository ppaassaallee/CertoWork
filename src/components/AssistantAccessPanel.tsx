import { useCallback, useEffect, useRef, useState } from "react";

type AccessToken = {
  id: string;
  label: string;
  token_prefix: string;
  scopes: string[];
  workspace_ids: string[];
  expires_at: string;
  revoked_at: string | null;
};

type Proposal = {
  id: string;
  action: string;
  item_id: string | null;
  payload: { title?: string; priority?: unknown; status?: string };
  status: string;
  assistant_label: string;
  created_at: string;
};

const SCOPES = [
  { id: "items:read", label: "Read items", locked: true },
  { id: "items:propose", label: "Propose changes", locked: false },
  { id: "items:write", label: "Write items directly", locked: false },
] as const;

async function api(path: string, token: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `Request failed (${response.status})`) as Error & { code?: string };
    error.code = body.code;
    throw error;
  }
  return body;
}

export function AssistantAccessPanel({
  workspaceId,
  workspaceName,
  getIdToken,
}: {
  workspaceId: string;
  workspaceName: string;
  getIdToken: () => Promise<string>;
}) {
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [label, setLabel] = useState("Executive assistant");
  const [days, setDays] = useState("90");
  const [propose, setPropose] = useState(true);
  const [write, setWrite] = useState(false);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const getIdTokenRef = useRef(getIdToken);
  getIdTokenRef.current = getIdToken;

  const load = useCallback(async () => {
    const idToken = await getIdTokenRef.current();
    const [tokenBody, proposalBody] = await Promise.all([
      api("/api/assistant/tokens", idToken),
      api(`/api/assistant/proposals?workspaceId=${encodeURIComponent(workspaceId)}&status=pending`, idToken),
    ]);
    setTokens(tokenBody.tokens || []);
    setProposals(proposalBody.proposals || []);
  }, [workspaceId]);

  useEffect(() => {
    void load().catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Could not load assistant access.");
    });
  }, [load]);

  const createToken = async () => {
    setBusy(true);
    setError("");
    setSecret("");
    try {
      const idToken = await getIdToken();
      const scopes = ["items:read", propose ? "items:propose" : "", write ? "items:write" : ""].filter(Boolean);
      const body = await api("/api/assistant/tokens", idToken, {
        method: "POST",
        body: JSON.stringify({
          label,
          workspaceIds: [workspaceId],
          scopes,
          expiresInDays: Number(days) || 90,
        }),
      });
      setSecret(String(body.token || ""));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create a token.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const idToken = await getIdToken();
      await api(`/api/assistant/tokens/${encodeURIComponent(id)}/revoke`, idToken, { method: "POST", body: "{}" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not revoke the token.");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: "approve" | "reject", ids = selected) => {
    if (!ids.length) return;
    setBusy(true);
    setError("");
    try {
      const idToken = await getIdToken();
      await api("/api/assistant/proposals/decide", idToken, {
        method: "POST",
        body: JSON.stringify({
          workspaceId,
          decisions: ids.map((id) => ({ id, decision })),
        }),
      });
      setSelected([]);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update proposals.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="do-workspace-admin-card" data-testid="assistant-access-panel">
      <div className="do-workspace-admin-head">
        <span className="do-kicker">Assistant</span>
        <strong>Personal access for {workspaceName}</strong>
      </div>
      <p className="do-panel-intro">
        Tokens read only this workspace, and only what you can see. The secret is shown once.
        Proposals wait here until you approve them.
      </p>
      {error ? <p className="do-signin-error">{error}</p> : null}
      <label>
        Label
        <input aria-label="Token label" onChange={(event) => setLabel(event.target.value)} value={label} />
      </label>
      <label>
        Expires in days
        <input aria-label="Token expiry days" onChange={(event) => setDays(event.target.value)} value={days} />
      </label>
      {SCOPES.map((scope) => (
        <label key={scope.id}>
          <input
            checked={scope.locked || (scope.id === "items:propose" ? propose : write)}
            disabled={scope.locked}
            onChange={(event) => {
              if (scope.id === "items:propose") setPropose(event.target.checked);
              if (scope.id === "items:write") setWrite(event.target.checked);
            }}
            type="checkbox"
          />
          {scope.label}
        </label>
      ))}
      <button disabled={busy} onClick={() => void createToken()} type="button">
        Create token
      </button>
      {secret ? (
        <p>
          Copy this token now. It will not be shown again.
          <code data-testid="assistant-token-secret">{secret}</code>
        </p>
      ) : null}
      <ul>
        {tokens.map((token) => (
          <li key={token.id}>
            <strong>{token.label}</strong> {token.token_prefix}… {token.scopes.join(", ")}
            {token.revoked_at ? " revoked" : ` until ${token.expires_at.slice(0, 10)}`}
            {!token.revoked_at ? (
              <button disabled={busy} onClick={() => void revoke(token.id)} type="button">
                Revoke
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <div>
        <strong>Proposed by assistant</strong>
        {proposals.length ? (
          <>
            <button disabled={busy || !selected.length} onClick={() => void decide("approve")} type="button">
              Approve selected
            </button>
            <button disabled={busy || !selected.length} onClick={() => void decide("reject")} type="button">
              Reject selected
            </button>
          </>
        ) : (
          <p>No pending proposals.</p>
        )}
        <ul>
          {proposals.map((proposal) => (
            <li key={proposal.id}>
              <label>
                <input
                  checked={selected.includes(proposal.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, proposal.id]
                        : current.filter((id) => id !== proposal.id),
                    )
                  }
                  type="checkbox"
                />
                {proposal.action} {proposal.payload?.title || proposal.item_id || "item"} · {proposal.assistant_label}
              </label>
              <button disabled={busy} onClick={() => void decide("approve", [proposal.id])} type="button">
                Approve
              </button>
              <button disabled={busy} onClick={() => void decide("reject", [proposal.id])} type="button">
                Reject
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

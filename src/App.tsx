import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ArrowRight, Check, Loader2, LogIn, Mail, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "./lib/AuthContext";
import { DelivereeWorkspace } from "./components/DelivereeWorkspace";
import { applyCertoTextSize, getStoredCertoTextSize } from "./lib/textSize";

function SignIn() {
  const { signIn, authError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessRequested, setAccessRequested] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async (method: 'popup' | 'redirect' = 'popup') => {
    setSubmitting(true);
    setRedirecting(method === 'redirect');
    setError("");
    try {
      await signIn(method);
    } catch (reason) {
      // AuthContext provides a precise, browser-safe message for the error.
      setError(reason instanceof Error ? reason.message : "Sign-in could not be completed.");
    } finally {
      setSubmitting(false);
      setRedirecting(false);
    }
  };

  return (
    <main className="do-signin">
      <div className="do-signin-bg" aria-hidden="true" />
      <div className="do-signin-vignette" aria-hidden="true" />
      <header>
        <div className="do-brand"><span className="do-logo">C</span><span><strong>Certo Work</strong><small>Think. Choose. Move.</small></span></div>
        <nav aria-label="Certo Work access">
          <button disabled={submitting} onClick={() => handleSignIn('popup')} type="button">Login</button>
          <a href="#request-access">Request access</a>
        </nav>
      </header>
      <div className="do-signin-hero">
        <section className="do-signin-copy" aria-labelledby="signin-title">
          <span className="do-kicker">CONVERSATIONAL WORK OS</span>
          <h1 id="signin-title">Run the work.<br />Not the noise.</h1>
          <p>Certo Work gives teams one calm place to capture decisions, plan delivery, track costs, and move projects forward—with approval before anything changes.</p>
          <div className="do-signin-actions">
            <button className="do-signin-button" disabled={submitting} onClick={() => handleSignIn('popup')} type="button">
              {submitting ? <Loader2 className="spin" size={17} /> : <LogIn size={17} />}
              {redirecting ? "Opening secure sign-in…" : "Login with Google"}
              <ArrowRight size={16} />
            </button>
            <button
              className="do-signin-secondary"
              disabled={submitting}
              onClick={() => handleSignIn('redirect')}
              type="button"
            >
              Full-page login
            </button>
          </div>
          {(authError || error) && <p className="do-signin-error" role="alert">{authError || error}</p>}
          <div className="do-signin-proof">
            <span><Check size={13} /> Invite-only workspaces</span>
            <span><Check size={13} /> Human approval</span>
            <span><Check size={13} /> Built for delivery teams</span>
          </div>
        </section>

        <section className="do-access-card" id="request-access" aria-labelledby="access-title">
          <span><ShieldCheck size={14} /> Private beta</span>
          <h2 id="access-title">Request access</h2>
          <p>Sign up requests stay pending until a workspace owner approves you.</p>
          {accessRequested ? (
            <div className="do-access-pending" role="status">
              <Sparkles size={16} />
              <strong>Request received</strong>
              <small>{accessEmail || "Your email"} is waiting for approval.</small>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setAccessRequested(true);
              }}
            >
              <label>
                Work email
                <input
                  autoComplete="email"
                  onChange={(event) => setAccessEmail(event.target.value)}
                  placeholder="name@company.com"
                  required
                  type="email"
                  value={accessEmail}
                />
              </label>
              <button type="submit"><Mail size={15} /> Sign up</button>
            </form>
          )}
          <small className="do-access-note">Already invited? Use Google login with the same email.</small>
        </section>
      </div>
      <footer>
        <span>Certo Work</span>
        <span>Chief of Staff · Projects · Costs · Teams</span>
        <span>Approval-first by design</span>
      </footer>
    </main>
  );
}

function WorkspaceRecovery() {
  const { reloadWorkspaces, logOut, workspaceError, workspaceLoading } = useAuth();
  const [retrying, setRetrying] = useState(false);

  return (
    <main className="do-recovery">
      <span className="do-logo">C</span>
      <h1>{workspaceLoading ? "Opening your workspace…" : "We couldn’t open your workspace."}</h1>
      <p>{workspaceError || "This should only take a few seconds. You can retry without losing any data."}</p>
      <div>
        <button
          disabled={retrying || workspaceLoading}
          onClick={async () => {
            setRetrying(true);
            await reloadWorkspaces();
            setRetrying(false);
          }}
          type="button"
        >
          {retrying || workspaceLoading ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
          {workspaceLoading ? "Connecting" : "Try again"}
        </button>
        <button onClick={logOut} type="button">Sign out</button>
      </div>
    </main>
  );
}

export default function App() {
  const { user, loading, workspace } = useAuth();

  useEffect(() => {
    applyCertoTextSize(getStoredCertoTextSize());
  }, []);

  if (loading) {
    return <div className="do-loading"><span className="do-logo">C</span><Loader2 className="spin" size={18} /><p>Opening Certo Work…</p></div>;
  }
  if (!user) return <SignIn />;
  if (!workspace) return <WorkspaceRecovery />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<DelivereeWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
}

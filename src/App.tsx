import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ArrowRight, Check, Loader2, LogIn, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "./lib/AuthContext";
import { DelivereeWorkspace } from "./components/DelivereeWorkspace";
import { applyCertoTextSize, getStoredCertoTextSize } from "./lib/textSize";

function SignIn() {
  const { signIn, authError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
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
      <div className="do-signin-glow" />
      <header>
        <div className="do-brand"><span className="do-logo">C</span><span><strong>Certo Work</strong><small>Think. Choose. Move.</small></span></div>
        <span className="do-signin-pill"><ShieldCheck size={13} /> You approve every change</span>
      </header>
      <div className="do-signin-grid">
        <section className="do-signin-copy">
          <span className="do-kicker">CONVERSATIONAL PRODUCTIVITY</span>
          <h1>Turn thought<br />into progress.</h1>
          <p>Capture, decide, plan, and move your work through one calm conversation. Projects add context without taking you into another app.</p>
          <button className="do-signin-button" disabled={submitting} onClick={() => handleSignIn('popup')} type="button">
            {submitting ? <Loader2 className="spin" size={17} /> : <LogIn size={17} />}
            {redirecting ? "Opening secure sign-in…" : "Continue with Google"}
            <ArrowRight size={16} />
          </button>
          {(authError || error) && <p className="do-signin-error" role="alert">{authError || error}</p>}
          <button
            className="do-signin-alternate"
            disabled={submitting}
            onClick={() => handleSignIn('redirect')}
            type="button"
          >
            Having trouble? Use full-page sign-in
          </button>
          <div className="do-signin-proof"><span><Check size={13} /> One conversation</span><span><Check size={13} /> Real workspace context</span><span><Check size={13} /> Approval before changes</span></div>
        </section>
        <section className="do-signin-preview" aria-label="Product preview">
          <div className="do-preview-top"><span><Sparkles size={15} /> Certo Work</span><small>All work</small></div>
          <div className="do-preview-thread">
            <div className="do-preview-user">Help me plan today without overloading it.</div>
            <div className="do-preview-answer"><span><Sparkles size={14} /></span><div><strong>Protect these two outcomes.</strong><p>Finish the client proposal first, then unblock the onboarding project. Move the remaining admin to one afternoon block.</p><div><button>Use this plan</button><button>Adjust priorities</button></div></div></div>
          </div>
          <div className="do-preview-compose">Ask, capture, or plan… <ArrowRight size={15} /></div>
        </section>
      </div>
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

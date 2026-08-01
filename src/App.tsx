import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ArrowRight, Check, Loader2, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "./lib/AuthContext";
import { DelivereeWorkspace } from "./components/DelivereeWorkspace";

function SignIn() {
  const { signIn } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    setSubmitting(true);
    setError("");
    try {
      await signIn();
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message.includes("popup")
          ? "The sign-in window was blocked or closed. Allow pop-ups for this site and try again."
          : "Google sign-in could not be completed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="do-signin">
      <div className="do-signin-glow" />
      <header>
        <div className="do-brand"><span className="do-logo">D</span><span><strong>DelivereeOS</strong><small>AI delivery, in conversation</small></span></div>
        <span className="do-signin-pill"><ShieldCheck size={13} /> Approval-gated by design</span>
      </header>
      <div className="do-signin-grid">
        <section className="do-signin-copy">
          <span className="do-kicker">CONVERSATIONAL AI DELIVERY</span>
          <h1>Run delivery.<br />Keep the reasoning.</h1>
          <p>DelivereeOS is a conversational Jira for AI work: opportunities, projects, issues, readiness, and reviews in one continuous interface.</p>
          <button className="do-signin-button" disabled={submitting} onClick={handleSignIn} type="button">
            {submitting ? <Loader2 className="spin" size={17} /> : <LogIn size={17} />}
            Continue with Google
            <ArrowRight size={16} />
          </button>
          {error && <p className="do-signin-error" role="alert">{error}</p>}
          <div className="do-signin-proof"><span><Check size={13} /> One conversational workspace</span><span><Check size={13} /> Real workspace data</span><span><Check size={13} /> Human approval before writes</span></div>
        </section>
        <section className="do-signin-preview" aria-label="Product preview">
          <div className="do-preview-top"><span><Sparkles size={15} /> DelivereeOS</span><small>Project · Voice Agent UAT</small></div>
          <div className="do-preview-thread">
            <div className="do-preview-user">Are we ready to move this project into UAT?</div>
            <div className="do-preview-answer"><span><Sparkles size={14} /></span><div><strong>Not yet.</strong><p>The release candidate is stable, but the rollback owner and Tier 2 runbook are still missing. I recommend closing those two gaps before UAT.</p><div><button>Draft runbook</button><button>Create two issues</button></div></div></div>
          </div>
          <div className="do-preview-compose">Ask about this project… <ArrowRight size={15} /></div>
        </section>
      </div>
    </main>
  );
}

export default function App() {
  const { user, loading, workspace } = useAuth();

  if (loading || (user && !workspace)) {
    return <div className="do-loading"><span className="do-logo">D</span><Loader2 className="spin" size={18} /></div>;
  }
  if (!user) return <SignIn />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<DelivereeWorkspace />} />
      </Routes>
    </BrowserRouter>
  );
}

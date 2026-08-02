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
        <div className="do-brand"><span className="do-logo">D</span><span><strong>DelivereeOS</strong><small>Think. Choose. Move.</small></span></div>
        <span className="do-signin-pill"><ShieldCheck size={13} /> You approve every change</span>
      </header>
      <div className="do-signin-grid">
        <section className="do-signin-copy">
          <span className="do-kicker">CONVERSATIONAL PRODUCTIVITY</span>
          <h1>Turn thought<br />into progress.</h1>
          <p>Capture, decide, plan, and move your work through one calm conversation. Projects add context without taking you into another app.</p>
          <button className="do-signin-button" disabled={submitting} onClick={handleSignIn} type="button">
            {submitting ? <Loader2 className="spin" size={17} /> : <LogIn size={17} />}
            Continue with Google
            <ArrowRight size={16} />
          </button>
          {error && <p className="do-signin-error" role="alert">{error}</p>}
          <div className="do-signin-proof"><span><Check size={13} /> One conversation</span><span><Check size={13} /> Real workspace context</span><span><Check size={13} /> Approval before changes</span></div>
        </section>
        <section className="do-signin-preview" aria-label="Product preview">
          <div className="do-preview-top"><span><Sparkles size={15} /> DelivereeOS</span><small>All work</small></div>
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

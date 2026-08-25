import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ArrowRight, Check, Loader2, LogIn, Mail, RefreshCw, ShieldCheck, Sparkles } from "./components/ui/Icon";
import { useAuth } from "./lib/AuthContext";
import { DelivereeWorkspace } from "./components/DelivereeWorkspace";
import { InviteActivate } from "./components/InviteActivate";
import { PublicStatusReport } from "./components/PublicStatusReport";
import { PublicInvoicePortal } from "./components/PublicInvoicePortal";
import { PublicAppleWidget } from "./components/PublicAppleWidget";
import { applyCertoTextSize, getStoredCertoTextSize } from "./lib/textSize";

// TODO: Replace with the Google Calendar appointment schedule URL.
const DEMO_BOOKING_URL = "PLACEHOLDER_CALENDAR_URL";

function SignIn() {
  const { signIn, signInWithEmail, requestBetaAccess, resetPasswordForEmail, authError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [mode, setMode] = useState<"choice" | "signin" | "access" | "reset">("choice");
  const [name, setName] = useState("");
  const [accessEmail, setAccessEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessRequested, setAccessRequested] = useState(false);
  const [notice, setNotice] = useState("");
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

  const handleEmailSignIn = async () => {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await signInWithEmail(accessEmail, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBetaAccess = async () => {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await requestBetaAccess(name, accessEmail, password);
      setAccessRequested(true);
      setNotice("Request received. Check your email to verify your address while a workspace owner approves access.");
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Access request could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await resetPasswordForEmail(accessEmail);
      setNotice("If this email has a Certo Work account, a reset link has been sent.");
    } catch {
      // Keep the response account-enumeration safe.
      setNotice("If this email has a Certo Work account, a reset link has been sent.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetPanel = (nextMode: typeof mode) => {
    setMode(nextMode);
    setError("");
    setNotice("");
    setAccessRequested(false);
    setPassword("");
  };

  return (
    <main className="do-signin">
      <div className="do-signin-bg" aria-hidden="true" />
      <div className="do-signin-vignette" aria-hidden="true" />
      <header>
        <div className="do-brand">
          <span className="do-logo">
            <svg aria-hidden="true" viewBox="0 0 32 32">
              <path
                d="M24 7H12.5A5.5 5.5 0 0 0 7 12.5v7A5.5 5.5 0 0 0 12.5 25H24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="butt"
                strokeLinejoin="round"
                strokeWidth="7"
              />
            </svg>
          </span>
          <span><strong>Certo Work</strong><small>Think. Choose. Move.</small></span>
        </div>
        <nav aria-label="Certo Work access">
          <button disabled={submitting} onClick={() => resetPanel("signin")} type="button">Sign in</button>
          <button className="do-signin-nav-extra" disabled={submitting} onClick={() => resetPanel("access")} type="button">Beta access</button>
          <a href={DEMO_BOOKING_URL} rel="noopener" target="_blank">Book demo</a>
        </nav>
      </header>
      <div className="do-signin-hero">
        <section className="do-signin-copy" aria-labelledby="signin-title">
          <span className="do-kicker">CONVERSATIONAL WORK OS</span>
          <h1 id="signin-title">Run the work.<br />Not the noise.</h1>
          <p>Certo Work gives teams one calm place to capture decisions, plan delivery, track costs, and move projects forward—with approval before anything changes.</p>
          <div className="do-signin-actions">
            <button className="do-signin-button" disabled={submitting} onClick={() => resetPanel("signin")} type="button">
              <LogIn size={17} />
              Sign in
              <ArrowRight size={16} />
            </button>
            <button
              className="do-signin-secondary"
              disabled={submitting}
              onClick={() => resetPanel("access")}
              type="button"
            >
              Request beta access
            </button>
          </div>
          {(authError || error) && <p className="do-signin-error" role="alert">{authError || error}</p>}
          <div className="do-signin-proof">
            <span><Check size={13} /> Invite-only workspaces</span>
            <span><Check size={13} /> You approve every change</span>
            <span><Check size={13} /> Built for delivery teams</span>
          </div>
          <p className="do-signin-pricing">
            <span className="do-signin-pricing-lead">Disruptive pricing</span>
            <span className="do-signin-pricing-offer">
              <span>Unlimited users</span>
              <span>$1 per month</span>
            </span>
          </p>
        </section>

        <section className="do-access-card" id="request-access" aria-labelledby="access-title">
          <span><ShieldCheck size={14} /> Private beta</span>
          {mode === "choice" && (
            <>
              <h2 id="access-title">Private workspace</h2>
              <p>Sign in if you already have access, or request beta access with any email provider.</p>
              <div className="do-access-choice">
                <button className="do-signin-button" onClick={() => resetPanel("signin")} type="button">
                  <LogIn size={15} /> Sign in
                </button>
                <button className="do-signin-secondary" onClick={() => resetPanel("access")} type="button">
                  <Mail size={15} /> Request beta
                </button>
              </div>
              <a className="do-signin-alternate" href={DEMO_BOOKING_URL} rel="noopener" target="_blank">
                Or book a 30-min demo →
              </a>
            </>
          )}
          {mode === "signin" && (
            <>
              <h2 id="access-title">Sign in</h2>
              <p>Use your email and password, or continue with Google if that is how your account was created.</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleEmailSignIn();
                }}
              >
                <label>
                  Email
                  <input
                    autoComplete="email"
                    onChange={(event) => setAccessEmail(event.target.value)}
                    placeholder="name@company.com"
                    required
                    type="email"
                    value={accessEmail}
                  />
                </label>
                <label>
                  Password
                  <input
                    autoComplete="current-password"
                    minLength={6}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                    type="password"
                    value={password}
                  />
                </label>
                <button disabled={submitting} type="submit">
                  {submitting ? <Loader2 className="spin" size={15} /> : <LogIn size={15} />}
                  Sign in
                </button>
              </form>
              <div className="do-signin-links">
                <button className="do-signin-alternate" disabled={submitting} onClick={() => handleSignIn("popup")} type="button">
                  {redirecting ? "Opening secure sign-in…" : "Continue with Google"}
                </button>
                <button className="do-signin-alternate" disabled={submitting} onClick={() => resetPanel("reset")} type="button">
                  Forgot password?
                </button>
              </div>
              <small className="do-access-note">Need access first? <button onClick={() => resetPanel("access")} type="button">Request beta access</button></small>
            </>
          )}
          {mode === "access" && (
            <>
              <h2 id="access-title">Request beta access</h2>
              <p>Create your login with any email. Your account stays pending until a workspace owner approves or invites you.</p>
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
                void handleBetaAccess();
              }}
            >
              <label>
                Name
                <input
                  autoComplete="name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  required
                  type="text"
                  value={name}
                />
              </label>
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
              <label>
                Password
                <input
                  autoComplete="new-password"
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  required
                  type="password"
                  value={password}
                />
              </label>
              <button disabled={submitting} type="submit">
                {submitting ? <Loader2 className="spin" size={15} /> : <Mail size={15} />}
                Request access
              </button>
            </form>
          )}
              <small className="do-access-note">Already approved? <button onClick={() => resetPanel("signin")} type="button">Sign in instead</button></small>
            </>
          )}
          {mode === "reset" && (
            <>
              <h2 id="access-title">Reset password</h2>
              <p>Enter the email you used for Certo Work. We’ll send a secure reset link.</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleResetPassword();
                }}
              >
                <label>
                  Email
                  <input
                    autoComplete="email"
                    onChange={(event) => setAccessEmail(event.target.value)}
                    placeholder="name@company.com"
                    required
                    type="email"
                    value={accessEmail}
                  />
                </label>
                <button disabled={submitting} type="submit">
                  {submitting ? <Loader2 className="spin" size={15} /> : <Mail size={15} />}
                  Send reset link
                </button>
              </form>
              <small className="do-access-note"><button onClick={() => resetPanel("signin")} type="button">Back to sign in</button></small>
            </>
          )}
          {notice && <p className="do-signin-notice" role="status">{notice}</p>}
        </section>
      </div>
      <footer>
        <span>Certo Work</span>
        <span>Odysseus · Projects · Approvals · Teams</span>
        <span>Max productivity for you and your AI agents</span>
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

  const inviteToken = typeof window !== "undefined"
    ? decodeURIComponent((window.location.pathname.match(/^\/invite\/([^/]+)/) || [])[1] || "")
    : "";
  const reportToken = typeof window !== "undefined"
    ? decodeURIComponent((window.location.pathname.match(/^\/report\/([^/]+)/) || [])[1] || "")
    : "";
  const invoiceToken = typeof window !== "undefined"
    ? decodeURIComponent((window.location.pathname.match(/^\/invoice\/([^/]+)/) || [])[1] || "")
    : "";
  const widgetToken = typeof window !== "undefined"
    ? decodeURIComponent((window.location.pathname.match(/^\/widget\/([^/]+)/) || [])[1] || "")
    : "";
  if (reportToken) {
    return <PublicStatusReport token={reportToken} />;
  }
  if (invoiceToken) {
    return <PublicInvoicePortal token={invoiceToken} />;
  }
  if (widgetToken) {
    return <PublicAppleWidget token={widgetToken} />;
  }
  if (loading) {
    return <div className="do-loading"><span className="do-logo">C</span><Loader2 className="spin" size={18} /><p>Opening Certo Work…</p></div>;
  }
  if (inviteToken) {
    return <InviteActivate token={inviteToken} />;
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

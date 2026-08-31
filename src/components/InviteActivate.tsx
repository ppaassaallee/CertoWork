import { useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { Loader2, LogIn, Mail, ShieldCheck } from "./ui/Icon";
import { useAuth } from "../lib/AuthContext";
import { auth, db } from "../lib/firebase";
import { googleSignInBrowserAdvice } from "../lib/authFlow";
import {
  existingAccountInviteMessage,
  inviteActivateErrorMessage,
  inviteCredentialsFromForm,
  resolveInviteAuthSession,
} from "../lib/inviteActivate";
import { inviteIsExpired, inviteIsUsable } from "../lib/inviteLifecycle";
import { membershipPublicPatch, pendingMemberId } from "../lib/workspaceCollaboration";

type Props = {
  token: string;
};

export function InviteActivate({ token }: Props) {
  const { user, signIn, resetPasswordForEmail } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [existingAccount, setExistingAccount] = useState(false);
  const acceptedFor = useRef("");
  const submittingRef = useRef(false);
  const browserAdvice = googleSignInBrowserAdvice();

  useEffect(() => {
    setError("");
    setNotice("");
    setExistingAccount(false);
    acceptedFor.current = "";
  }, [token]);

  const acceptSignedInUser = async (displayName = name.trim()) => {
    const current = auth.currentUser;
    if (!current?.email) throw new Error("Sign-in did not complete.");
    const snap = await getDocs(
      query(collection(db, "agent_invites"), where("inviteToken", "==", token)),
    );
    const inviteDoc = snap.docs[0];
    const invite = inviteDoc ? ({ id: inviteDoc.id, ...inviteDoc.data() } as Record<string, any>) : null;
    if (!invite) throw new Error("This invitation link is invalid.");
    if (!inviteIsUsable(invite) && String(invite.status || "").toLowerCase() !== "accepted") {
      throw new Error("This invitation has already been used or revoked.");
    }
    if (inviteIsExpired(invite)) throw new Error("This invitation has expired. Ask an admin to send a new one.");
    const invitedEmail = String(invite.emailLower || invite.email || "").toLowerCase();
    if (invitedEmail && invitedEmail !== current.email.toLowerCase()) {
      throw new Error(`Sign in with the invited email: ${invitedEmail}`);
    }
    const workspaceId = String(invite.workspaceId || "");
    if (!workspaceId) throw new Error("This invitation is missing a workspace.");
    if (displayName && current.displayName !== displayName) {
      await updateProfile(current, { displayName }).catch(() => undefined);
    }
    const memberId = `${workspaceId}_${current.uid}`;
    await setDoc(
      doc(db, "workspace_members", memberId),
      {
        id: memberId,
        workspaceId,
        userId: current.uid,
        email: current.email,
        emailLower: current.email.toLowerCase(),
        ...membershipPublicPatch({ displayName: displayName || current.displayName }),
        role: invite.role || "member",
        status: "active",
        portfolioViewer: String(invite.role || "member").toLowerCase() !== "viewer",
        acceptedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    if (inviteIsUsable(invite)) {
      await updateDoc(doc(db, "agent_invites", invite.id), {
        status: "accepted",
        acceptedBy: current.uid,
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    const pendingId = pendingMemberId(workspaceId, invitedEmail || current.email);
    if (pendingId && pendingId !== memberId) {
      await updateDoc(doc(db, "workspace_members", pendingId), {
        status: "accepted",
        acceptedUserId: current.uid,
        acceptedMemberId: memberId,
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
    }
    setNotice("Account activated. Opening Certo Work…");
    window.setTimeout(() => {
      window.location.assign("/");
    }, 800);
  };

  useEffect(() => {
    if (!user?.email || submittingRef.current) return;
    const key = `${token}:${user.uid}`;
    if (acceptedFor.current === key) return;
    acceptedFor.current = key;
    setEmail((current) => current || user.email || "");
    setName((current) => current || user.displayName || "");
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    void acceptSignedInUser(user.displayName || "")
      .catch(async (reason) => {
        setError(inviteActivateErrorMessage(reason));
        const mismatch = reason instanceof Error && /invited email/i.test(reason.message);
        if (mismatch) {
          acceptedFor.current = "";
          await signOut(auth).catch(() => undefined);
        }
      })
      .finally(() => {
        submittingRef.current = false;
        setSubmitting(false);
      });
  }, [user?.uid, user?.email, token]);

  const activate = async (form?: HTMLFormElement | null) => {
    const credentials = inviteCredentialsFromForm(form || formRef.current, { email, name, password });
    const cleanEmail = credentials.email;
    const displayName = credentials.name;
    const nextPassword = credentials.password;
    setEmail(cleanEmail);
    setName(displayName);
    if (nextPassword) setPassword(nextPassword);
    if (!cleanEmail || nextPassword.length < 6) {
      setError("Use the invited email and a password of at least 6 characters.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const result = await resolveInviteAuthSession(cleanEmail, nextPassword, {
        signInWithPassword: (nextEmail, nextSecret) => signInWithEmailAndPassword(auth, nextEmail, nextSecret),
        createWithPassword: (nextEmail, nextSecret) => createUserWithEmailAndPassword(auth, nextEmail, nextSecret),
      });
      if (result.status === "existing-account") {
        setExistingAccount(true);
        setPassword("");
        setError(existingAccountInviteMessage());
        return;
      }
      if (result.status === "error") {
        throw result.error;
      }
      const current = auth.currentUser;
      if (result.status === "created" && current) {
        if (displayName) await updateProfile(current, { displayName });
        await sendEmailVerification(current).catch(() => undefined);
      }
      await acceptSignedInUser(displayName);
    } catch (reason) {
      setError(inviteActivateErrorMessage(reason, existingAccount));
      if (existingAccount || isLikelyExistingAccount(reason)) {
        setExistingAccount(true);
      }
      if (!auth.currentUser) return;
      await signOut(auth).catch(() => undefined);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const activateWithGoogle = async () => {
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await signIn();
      if (auth.currentUser) await acceptSignedInUser();
    } catch (reason) {
      setError(inviteActivateErrorMessage(reason));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const sendReset = async () => {
    const cleanEmail = inviteCredentialsFromForm(formRef.current, { email }).email;
    if (!cleanEmail) {
      setError("Enter the invited email first.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      if (resetPasswordForEmail) {
        await resetPasswordForEmail(cleanEmail);
      } else {
        await sendPasswordResetEmail(auth, cleanEmail);
      }
      setNotice("If this email has a Certo Work account, a reset link has been sent. Open it, then come back to this invitation.");
    } catch (reason) {
      setNotice("If this email has a Certo Work account, a reset link has been sent. Open it, then come back to this invitation.");
      void reason;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <main className="do-signin">
      <div className="do-signin-bg" aria-hidden="true" />
      <section className="do-access-card" style={{ margin: "10vh auto", maxWidth: 420 }}>
        <span><ShieldCheck size={14} /> Workspace invitation</span>
        <h2>Activate your Certo Work account</h2>
        <p>
          {existingAccount
            ? "This email already has an account. Use your current password or Google — a newly generated password will not work."
            : "Create a password if you are new, or confirm the password you already use. After this, you can sign in with the same credentials."}
        </p>
        <form
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            void activate(event.currentTarget);
          }}
        >
          <label>
            Invited email
            <input
              autoComplete="username"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              onInput={(event) => setEmail(event.currentTarget.value)}
              type="email"
              value={email}
            />
          </label>
          <label>
            Display name
            <input
              autoComplete="name"
              name="displayName"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <label>
            Password
            <input
              autoComplete={existingAccount ? "current-password" : "new-password"}
              minLength={6}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              onInput={(event) => setPassword(event.currentTarget.value)}
              type="password"
              value={password}
            />
          </label>
          <button className="do-signin-button" disabled={submitting} type="submit">
            {submitting ? <Loader2 className="spin" size={15} /> : <LogIn size={15} />}
            {existingAccount ? "Sign in and activate" : "Activate account"}
          </button>
        </form>
        <div className="do-signin-links">
          <button className="do-signin-alternate" disabled={submitting} onClick={() => void activateWithGoogle()} type="button">
            Continue with Google
          </button>
          {browserAdvice ? <small className="do-access-note">{browserAdvice}</small> : null}
          <button className="do-signin-alternate" disabled={submitting} onClick={() => void sendReset()} type="button">
            <Mail size={14} /> Send password reset
          </button>
        </div>
        {error && <p className="do-signin-error" role="alert">{error}</p>}
        {notice && <p className="do-signin-notice">{notice}</p>}
        <button
          className="do-signin-alternate"
          onClick={() => window.location.assign("/")}
          type="button"
        >
          Open Certo Work
        </button>
      </section>
    </main>
  );
}

function isLikelyExistingAccount(reason: unknown) {
  const message = inviteActivateErrorMessage(reason);
  return /already has a Certo Work account|email or password is not correct/i.test(message);
}

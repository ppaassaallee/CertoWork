import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
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
import { Loader2, ShieldCheck } from "lucide-react";
import { auth, db } from "../lib/firebase";
import { inviteIsExpired, inviteIsUsable } from "../lib/inviteLifecycle";
import { membershipPublicPatch } from "../lib/workspaceCollaboration";

type Props = {
  token: string;
};

export function InviteActivate({ token }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setError("");
    setNotice("");
  }, [token]);

  const activate = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || password.length < 6) {
      setError("Use the invited email and a password of at least 6 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      try {
        await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (name.trim()) {
          await updateProfile(auth.currentUser!, { displayName: name.trim() });
        }
        await sendEmailVerification(auth.currentUser!).catch(() => undefined);
      } catch (reason: any) {
        if (String(reason?.code || "").includes("email-already-in-use")) {
          await signInWithEmailAndPassword(auth, cleanEmail, password);
        } else {
          throw reason;
        }
      }
      const user = auth.currentUser;
      if (!user?.email) throw new Error("Sign-in did not complete.");
      const snap = await getDocs(
        query(collection(db, "agent_invites"), where("inviteToken", "==", token)),
      );
      const inviteDoc = snap.docs[0];
      const invite = inviteDoc ? ({ id: inviteDoc.id, ...inviteDoc.data() } as Record<string, any>) : null;
      if (!invite) throw new Error("This invitation link is invalid.");
      if (!inviteIsUsable(invite)) throw new Error("This invitation has already been used or revoked.");
      if (inviteIsExpired(invite)) throw new Error("This invitation has expired. Ask an admin to send a new one.");
      const invitedEmail = String(invite.emailLower || invite.email || "").toLowerCase();
      if (invitedEmail && invitedEmail !== user.email.toLowerCase()) {
        throw new Error(`Sign in with the invited email: ${invitedEmail}`);
      }
      const workspaceId = String(invite.workspaceId || "");
      if (!workspaceId) throw new Error("This invitation is missing a workspace.");
      const memberId = `${workspaceId}_${user.uid}`;
      await setDoc(
        doc(db, "workspace_members", memberId),
        {
          id: memberId,
          workspaceId,
          userId: user.uid,
          email: user.email,
          emailLower: user.email.toLowerCase(),
          ...membershipPublicPatch({ displayName: name.trim() || user.displayName }),
          role: invite.role || "member",
          status: "active",
          acceptedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await updateDoc(doc(db, "agent_invites", invite.id), {
        status: "accepted",
        acceptedBy: user.uid,
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNotice("Account activated. You can sign out and sign back in with this email and password.");
      window.setTimeout(() => {
        window.location.assign("/");
      }, 1200);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invitation could not be activated.");
      await signOut(auth).catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="do-signin">
      <div className="do-signin-bg" aria-hidden="true" />
      <section className="do-access-card" style={{ margin: "10vh auto", maxWidth: 420 }}>
        <span><ShieldCheck size={14} /> Workspace invitation</span>
        <h2>Activate your Certo Work account</h2>
        <p>Create or confirm your password. After this, you can log out and log back in with the same credentials.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void activate();
          }}
        >
          <label>
            Invited email
            <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
          </label>
          <label>
            Display name
            <input onChange={(event) => setName(event.target.value)} value={name} />
          </label>
          <label>
            Password
            <input autoComplete="new-password" minLength={6} onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
          </label>
          <button className="do-signin-button" disabled={submitting} type="submit">
            {submitting ? <Loader2 className="spin" size={15} /> : null}
            Activate account
          </button>
        </form>
        {error && <p className="do-signin-error" role="alert">{error}</p>}
        {notice && <p>{notice}</p>}
      </section>
    </main>
  );
}

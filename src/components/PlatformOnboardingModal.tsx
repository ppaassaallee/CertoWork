import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebase";
import {
  needsPlatformOnboarding,
  platformCompanyName,
  platformEmail,
  platformProfileName,
} from "../lib/platformOnboarding";
import { activeMemberId, membershipPublicPatch } from "../lib/workspaceCollaboration";
import { CertoMark } from "./CertoMark";

export function PlatformOnboardingModal() {
  const { user, workspace, reloadWorkspaces } = useAuth();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const memberId = useMemo(
    () => (user && workspace ? activeMemberId(workspace.id, user.uid) : ""),
    [user, workspace],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user || !workspace || !memberId) {
        setReady(true);
        setOpen(false);
        return;
      }
      const memberSnap = await getDoc(doc(db, "workspace_members", memberId)).catch(() => null);
      const member = memberSnap?.exists() ? memberSnap.data() : {};
      const profile = {
        name: user.displayName,
        alias: member?.alias,
        displayName: member?.displayName || user.displayName,
        email: user.email,
        company: member?.company || workspace.name,
        workspaceName: workspace.name,
        platformOnboardedAt: member?.platformOnboardedAt,
      };
      if (cancelled) return;
      setName(platformProfileName(profile));
      setCompany(platformCompanyName(profile));
      setEmail(platformEmail(profile) || String(user.email || ""));
      setOpen(needsPlatformOnboarding(profile));
      setReady(true);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [memberId, user, workspace]);

  if (!ready || !open || !user || !workspace || !memberId) return null;

  const submit = async () => {
    const nextName = name.trim();
    const nextCompany = company.trim();
    const nextEmail = email.trim() || String(user.email || "");
    if (!nextName || !nextCompany || !nextEmail) {
      setError("Name, company, and email are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await setDoc(
        doc(db, "workspace_members", memberId),
        {
          id: memberId,
          workspaceId: workspace.id,
          userId: user.uid,
          email: nextEmail,
          emailLower: nextEmail.toLowerCase(),
          company: nextCompany,
          platformOnboardedAt: serverTimestamp(),
          ...membershipPublicPatch({ displayName: nextName }),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await updateDoc(doc(db, "workspaces", workspace.id), {
        name: nextCompany,
        company: nextCompany,
        updatedAt: serverTimestamp(),
      });
      await updateProfile(user, { displayName: nextName }).catch(() => undefined);
      await reloadWorkspaces();
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      aria-label="Set up Certo Work"
      aria-modal="true"
      className="do-alias-gate"
      data-testid="platform-onboarding"
      role="dialog"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <CertoMark size={36} />
        <span className="do-kicker">Certo Work</span>
        <h2>Set up your workspace</h2>
        <p>
          This profile is for the whole platform — Work, Chat Collab, and invites.
          Chat Collab should not ask for it again.
        </p>
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
          Company
          <input
            autoComplete="organization"
            onChange={(event) => setCompany(event.target.value)}
            placeholder="Company or workspace"
            required
            type="text"
            value={company}
          />
        </label>
        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            readOnly={Boolean(user.email)}
            required
            type="email"
            value={email}
          />
        </label>
        {error ? <p className="do-signin-error">{error}</p> : null}
        <button disabled={saving} type="submit">
          {saving ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}

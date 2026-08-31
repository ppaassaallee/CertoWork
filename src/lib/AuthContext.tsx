import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  AUTH_BOOT_TIMEOUT_MS,
  AUTH_POPUP_TIMEOUT_MS,
  authErrorMessage,
  preferredGoogleSignInMethod,
  shouldFallbackGoogleSignInToRedirect,
  withAuthTimeout,
} from './authFlow';
import { inviteShouldCloseOnJoin } from './inviteLifecycle';
import { looksLikeEmail, membershipPublicPatch, canSeeWorkspaceDocument } from './workspaceCollaboration';

function publicAuthName(displayName?: string | null) {
  const name = String(displayName || "").trim();
  return looksLikeEmail(name) ? "" : name;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members?: string[];
  color?: string;
  description?: string;
  roles?: Record<string, string>;
}

interface AuthContextType {
  user: User | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  setWorkspace: (ws: Workspace | null) => void;
  loading: boolean;
  workspaceLoading: boolean;
  workspaceError: string;
  authError: string;
  signIn: (method?: 'popup' | 'redirect') => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  requestBetaAccess: (name: string, email: string, password: string) => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  logOut: () => Promise<void>;
  reloadWorkspaces: () => Promise<void>;
  sendPasswordReset: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  workspace: null,
  workspaces: [],
  setWorkspace: () => {},
  loading: true,
  workspaceLoading: false,
  workspaceError: '',
  authError: '',
  signIn: async () => {},
  signInWithEmail: async () => {},
  requestBetaAccess: async () => {},
  resetPasswordForEmail: async () => {},
  logOut: async () => {},
  reloadWorkspaces: async () => {},
  sendPasswordReset: async () => {},
});

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspaceState] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [authError, setAuthError] = useState('');

  const loadWorkspaces = async (u: User) => {
    setWorkspaceError('');
    try {
      const wsMap = new Map();
      const memberWorkspaceIds = new Set<string>();
      let lookupSucceeded = false;

      // Query owned workspaces
      try {
        const qOwner = query(collection(db, 'workspaces'), where('ownerId', '==', u.uid));
        const snapOwner = await withTimeout(getDocs(qOwner), 7_000, 'Workspace owner lookup');
        lookupSucceeded = true;
        snapOwner.forEach(d => wsMap.set(d.id, { id: d.id, ...d.data() }));
      } catch (eOwner) {
        console.error("Failed to load owned workspaces:", eOwner instanceof Error ? eOwner.message : eOwner);
      }
      
      // Query member workspaces via workspace_members (safe and respects individual permissions)
      try {
        const qMemberships = query(collection(db, 'workspace_members'), where('userId', '==', u.uid));
        const snapMemberships = await withTimeout(getDocs(qMemberships), 7_000, 'Workspace membership lookup');
        lookupSucceeded = true;
        
        const fetchPromises = snapMemberships.docs.map(async (mDoc) => {
          const mData = mDoc.data();
          const wsId = mData.workspaceId;
          if (!wsId || mData.status === "removed") return;
          memberWorkspaceIds.add(wsId);
          if (wsMap.has(wsId)) return;
          try {
            const wsRef = doc(db, 'workspaces', wsId);
            const wsSnap = await withTimeout(getDoc(wsRef), 5_000, `Workspace ${wsId} lookup`);
            if (wsSnap.exists()) {
              wsMap.set(wsId, { id: wsId, ...wsSnap.data() });
            }
          } catch (eGetWs) {
            console.error(`Failed to load workspace document ${wsId}:`, eGetWs);
          }
        });
        await Promise.allSettled(fetchPromises);
      } catch (eMember) {
        console.error("Failed to load member workspaces:", eMember instanceof Error ? eMember.message : eMember);
      }

      // Accept workspace invites that were granted by email. New users cannot
      // always read pending workspace_members documents before becoming active
      // members, but they can discover workspaces whose members array already
      // contains their verified sign-in email.
      if (u.email) {
        try {
          const emailLower = u.email.toLowerCase();
          const qEmailWorkspaces = query(collection(db, 'workspaces'), where('members', 'array-contains', emailLower));
          const snapEmailWorkspaces = await withTimeout(getDocs(qEmailWorkspaces), 7_000, 'Workspace email invite lookup');
          lookupSucceeded = true;
          const invitePromises = snapEmailWorkspaces.docs.map(async (wsDoc) => {
            const ws = { id: wsDoc.id, ...wsDoc.data() } as Workspace;
            wsMap.set(wsDoc.id, ws);
            const memberId = `${wsDoc.id}_${u.uid}`;
            await withTimeout(setDoc(doc(db, 'workspace_members', memberId), {
              id: memberId,
              workspaceId: wsDoc.id,
              userId: u.uid,
              email: u.email || "",
              emailLower,
              ...membershipPublicPatch({ displayName: publicAuthName(u.displayName) }),
              role: (ws as any).roles?.[emailLower] || "member",
              status: "active",
              acceptedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }, { merge: true }), 5_000, `Accept email invite ${wsDoc.id}`);
          });
          await Promise.allSettled(invitePromises);
        } catch (eEmailInvite) {
          console.error("Failed to load email-invited workspaces:", eEmailInvite instanceof Error ? eEmailInvite.message : eEmailInvite);
        }
      }

      // Accept pending email invitations automatically once the invited person signs in.
      if (u.email) {
        try {
          const emailLower = u.email.toLowerCase();
          const qInvited = query(collection(db, 'workspace_members'), where('emailLower', '==', emailLower));
          const snapInvited = await withTimeout(getDocs(qInvited), 7_000, 'Workspace invite lookup');
          lookupSucceeded = true;
          let inviteSnaps: Awaited<ReturnType<typeof getDocs>>["docs"] = [];
          try {
            const snapInvites = await withTimeout(
              getDocs(query(collection(db, 'agent_invites'), where('emailLower', '==', emailLower))),
              7_000,
              'Pending invite lookup',
            );
            inviteSnaps = snapInvites.docs;
          } catch (eInviteDocs) {
            console.error("Failed to load pending invite documents:", eInviteDocs);
          }
          const invitePromises = snapInvited.docs.map(async (mDoc) => {
            const mData = mDoc.data();
            const wsId = mData.workspaceId;
            if (!wsId || mData.status === 'removed') return;
            memberWorkspaceIds.add(wsId);
            try {
              const wsRef = doc(db, 'workspaces', wsId);
              const wsSnap = await withTimeout(getDoc(wsRef), 5_000, `Invited workspace ${wsId} lookup`);
              if (!wsSnap.exists()) return;
              wsMap.set(wsId, { id: wsId, ...wsSnap.data() });
              const memberId = `${wsId}_${u.uid}`;
              await withTimeout(setDoc(doc(db, 'workspace_members', memberId), {
                id: memberId,
                workspaceId: wsId,
                userId: u.uid,
                email: u.email || "",
                emailLower,
                ...membershipPublicPatch({
                  alias: mData.alias,
                  emoji: mData.emoji,
                  displayName: publicAuthName(mData.displayName || u.displayName),
                }),
                role: mData.role || "member",
                status: "active",
                invitedBy: mData.invitedBy || "",
                acceptedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              }, { merge: true }), 5_000, `Accept invite ${wsId}`);
              if (mDoc.id !== memberId) {
                await withTimeout(updateDoc(mDoc.ref, {
                  status: "accepted",
                  acceptedUserId: u.uid,
                  acceptedAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                }), 5_000, `Mark invite ${wsId} accepted`);
              }
              await Promise.all(inviteSnaps.map(async (inviteDoc) => {
                const inviteData = inviteDoc.data() as {
                  status?: string;
                  inviteType?: string;
                  workspaceId?: string;
                };
                if (!inviteShouldCloseOnJoin(inviteData, wsId)) return;
                await withTimeout(updateDoc(inviteDoc.ref, {
                  status: "accepted",
                  acceptedBy: u.uid,
                  acceptedAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                }), 5_000, `Close invite ${inviteDoc.id}`);
              }));
            } catch (eInviteWs) {
              console.error(`Failed to accept workspace invite ${wsId}:`, eInviteWs);
            }
          });
          await Promise.allSettled(invitePromises);
        } catch (eInvite) {
          console.error("Failed to load invited workspaces:", eInvite instanceof Error ? eInvite.message : eInvite);
        }
      }
      
      const allWs = (Array.from(wsMap.values()) as Workspace[]).filter((ws) =>
        canSeeWorkspaceDocument(ws, u, memberWorkspaceIds),
      );
      
      if (allWs.length > 0) {
        const storedId = localStorage.getItem('activeWorkspaceId');
        const active = allWs.find(w => w.id === storedId) || allWs[0];

        // Open the workspace before non-critical membership housekeeping.
        setWorkspaces(allWs);
        setWorkspaceState(active);
        localStorage.setItem('activeWorkspaceId', active.id);
        localStorage.setItem('activeWorkspaceName', active.name || 'Workspace');

        // Ensure deterministic workspace_members documents without blocking startup.
        const memberPromises = allWs.map(async (ws) => {
          try {
            const memberId = `${ws.id}_${u.uid}`;
            const memberRef = doc(db, 'workspace_members', memberId);
            const isOwner = ws.ownerId === u.uid;
            
            await withTimeout(setDoc(memberRef, {
              id: memberId,
              workspaceId: ws.id,
              userId: u.uid,
              email: u.email || "",
              emailLower: (u.email || "").toLowerCase(),
              role: isOwner ? "owner" : ((ws as any).roles?.[(u.email || "").toLowerCase()] || (ws as any).roles?.[u.email || ""] || "member"),
              status: "active",
              ...(isOwner ? { portfolioViewer: true } : {}),
              updatedAt: serverTimestamp()
            }, { merge: true }), 5_000, `Workspace ${ws.id} membership update`);
          } catch (eMemberDoc) {
            console.error(`Failed to ensure membership doc for workspace ${ws.id}:`, eMemberDoc instanceof Error ? eMemberDoc.message : eMemberDoc);
          }
        });
        void Promise.allSettled(memberPromises);
      } else {
        if (!lookupSucceeded) {
          throw new Error('Workspace lookups did not complete');
        }
        const isEmailPasswordAccount = u.providerData.some((provider) => provider.providerId === "password");
        if (isEmailPasswordAccount) {
          const requestSnap = await withTimeout(getDoc(doc(db, 'access_requests', u.uid)), 5_000, 'Access request lookup');
          const requestStatus = requestSnap.exists() ? String(requestSnap.data().status || 'pending') : 'pending';
          if (requestStatus !== 'approved') {
            setWorkspaceState(null);
            setWorkspaces([]);
            setWorkspaceError("Your Certo Work access request is waiting for workspace approval.");
            return;
          }
        }
        const newRef = doc(collection(db, 'workspaces'));
        const newWs = {
          name: "Personal Focus",
          ownerId: u.uid,
          members: [u.email].filter(Boolean) as string[],
          roles: u.email ? { [u.email.toLowerCase()]: "owner" } : {},
          color: "var(--accent)",
          createdAt: serverTimestamp()
        };
        await withTimeout(setDoc(newRef, newWs), 7_000, 'Workspace creation');

        // Bootstrap owner member document
        const memberId = `${newRef.id}_${u.uid}`;
        await withTimeout(setDoc(doc(db, 'workspace_members', memberId), {
          id: memberId,
          workspaceId: newRef.id,
          userId: u.uid,
          email: u.email || "",
          emailLower: (u.email || "").toLowerCase(),
          ...membershipPublicPatch({ displayName: publicAuthName(u.displayName) }),
          role: "owner",
          status: "active",
          portfolioViewer: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }), 7_000, 'Owner membership creation');

        const created = { id: newRef.id, ...newWs } as Workspace;
        setWorkspaces([created]);
        setWorkspaceState(created);
        localStorage.setItem('activeWorkspaceId', created.id);
        localStorage.setItem('activeWorkspaceName', created.name);
      }
    } catch (e) {
      console.error("Failed in loadWorkspaces master routine:", e instanceof Error ? e.message : e);
      setWorkspaceError("Your workspace could not be opened. Check your connection and try again.");
    }
  };

  useEffect(() => {
    const authTimeout = window.setTimeout(() => {
      setLoading(false);
      setAuthError('Your session took too long to open. Sign in again to continue.');
    }, AUTH_BOOT_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      window.clearTimeout(authTimeout);
      setUser(u);
      if (u) {
        setAuthError('');
        setLoading(false);
        setWorkspaceLoading(true);
        try {
          await loadWorkspaces(u);
        } finally {
          setWorkspaceLoading(false);
        }
      } else {
        setWorkspaceState(null);
        setWorkspaces([]);
        setWorkspaceError('');
        setLoading(false);
      }
    });

    // Completes the fallback flow after Google returns to this page. The auth
    // observer above remains the single source of truth for the signed-in user.
    void getRedirectResult(auth).catch((reason) => {
      window.clearTimeout(authTimeout);
      setAuthError(authErrorMessage(reason));
      setLoading(false);
    });

    return () => {
      window.clearTimeout(authTimeout);
      unsubscribe();
    };
  }, []);

  const setWorkspace = (ws: Workspace | null) => {
    if (ws) {
        localStorage.setItem('activeWorkspaceId', ws.id);
        localStorage.setItem('activeWorkspaceName', ws.name || 'Workspace');
    } else {
        localStorage.removeItem('activeWorkspaceId');
        localStorage.removeItem('activeWorkspaceName');
    }
    setWorkspaceState(ws);
    // Reload to re-fetch all queries with new workspaceId
    window.location.reload();
  };

  const reloadWorkspaces = async () => {
    if (!user) return;
    setWorkspaceLoading(true);
    try {
      await loadWorkspaces(user);
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const signIn = async (method?: 'popup' | 'redirect') => {
    setAuthError('');
    const chosen = method ?? preferredGoogleSignInMethod();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await setPersistence(auth, browserLocalPersistence);
      if (chosen === 'redirect') {
        await signInWithRedirect(auth, provider);
        return;
      }
      try {
        await withAuthTimeout(
          signInWithPopup(auth, provider),
          AUTH_POPUP_TIMEOUT_MS,
          'Google sign-in',
        );
      } catch (reason) {
        if (shouldFallbackGoogleSignInToRedirect(reason)) {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw reason;
      }
    } catch (reason) {
      const message = authErrorMessage(reason);
      setAuthError(message);
      throw new Error(message);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError('');
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (reason) {
      const message = authErrorMessage(reason);
      setAuthError(message);
      throw new Error(message);
    }
  };

  const requestBetaAccess = async (name: string, email: string, password: string) => {
    setAuthError('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      if (cleanName) {
        await updateProfile(credential.user, { displayName: cleanName });
      }
      await setDoc(doc(db, 'access_requests', credential.user.uid), {
        id: credential.user.uid,
        userId: credential.user.uid,
        email: cleanEmail,
        emailLower: cleanEmail,
        displayName: cleanName,
        status: 'pending',
        provider: 'password',
        requestedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await sendEmailVerification(credential.user).catch(() => undefined);
      await signOut(auth);
    } catch (reason) {
      const message = authErrorMessage(reason);
      setAuthError(message);
      throw new Error(message);
    }
  };

  const resetPasswordForEmail = async (email: string) => {
    setAuthError('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (reason) {
      const message = authErrorMessage(reason);
      setAuthError(message);
      throw new Error(message);
    }
  };

  const logOut = async () => {
    await signOut(auth);
  };

  const sendPasswordReset = async () => {
    if (!user?.email) throw new Error("No email is available for this account.");
    await sendPasswordResetEmail(auth, user.email);
  };

  return (
    <AuthContext.Provider value={{ user, workspace, workspaces, setWorkspace, loading, workspaceLoading, workspaceError, authError, signIn, signInWithEmail, requestBetaAccess, resetPasswordForEmail, logOut, reloadWorkspaces, sendPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

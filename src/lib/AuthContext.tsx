import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members?: string[];
}

interface AuthContextType {
  user: User | null;
  workspace: Workspace | null;
  workspaces: Workspace[];
  setWorkspace: (ws: Workspace | null) => void;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  reloadWorkspaces: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  workspace: null,
  workspaces: [],
  setWorkspace: () => {},
  loading: true,
  signIn: async () => {},
  logOut: async () => {},
  reloadWorkspaces: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspaceState] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWorkspaces = async (u: User) => {
    try {
      const wsMap = new Map();

      // Query owned workspaces
      try {
        const qOwner = query(collection(db, 'workspaces'), where('ownerId', '==', u.uid));
        const snapOwner = await getDocs(qOwner);
        snapOwner.forEach(d => wsMap.set(d.id, { id: d.id, ...d.data() }));
      } catch (eOwner) {
        console.error("Failed to load owned workspaces:", eOwner instanceof Error ? eOwner.message : eOwner);
      }
      
      // Query member workspaces via workspace_members (safe and respects individual permissions)
      try {
        const qMemberships = query(collection(db, 'workspace_members'), where('userId', '==', u.uid));
        const snapMemberships = await getDocs(qMemberships);
        
        const fetchPromises = snapMemberships.docs.map(async (mDoc) => {
          const mData = mDoc.data();
          const wsId = mData.workspaceId;
          if (wsId && !wsMap.has(wsId)) {
            try {
              const wsRef = doc(db, 'workspaces', wsId);
              const wsSnap = await getDoc(wsRef);
              if (wsSnap.exists()) {
                wsMap.set(wsId, { id: wsId, ...wsSnap.data() });
              }
            } catch (eGetWs) {
              console.error(`Failed to load workspace document ${wsId}:`, eGetWs);
            }
          }
        });
        await Promise.all(fetchPromises);
      } catch (eMember) {
        console.error("Failed to load member workspaces:", eMember instanceof Error ? eMember.message : eMember);
      }
      
      const allWs = Array.from(wsMap.values()) as Workspace[];
      
      if (allWs.length > 0) {
        // Bootstrap and ensure deterministic workspace_members documents exist
        const memberPromises = allWs.map(async (ws) => {
          try {
            const memberId = `${ws.id}_${u.uid}`;
            const memberRef = doc(db, 'workspace_members', memberId);
            const isOwner = ws.ownerId === u.uid;
            
            await setDoc(memberRef, {
              id: memberId,
              workspaceId: ws.id,
              userId: u.uid,
              email: u.email || "",
              displayName: u.displayName || "",
              role: isOwner ? "owner" : ((ws as any).roles?.[u.email || ""] || "member"),
              status: "active",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            }, { merge: true });
          } catch (eMemberDoc) {
            console.error(`Failed to ensure membership doc for workspace ${ws.id}:`, eMemberDoc instanceof Error ? eMemberDoc.message : eMemberDoc);
          }
        });
        await Promise.all(memberPromises);

        setWorkspaces(allWs);
        const storedId = localStorage.getItem('activeWorkspaceId');
        const active = allWs.find(w => w.id === storedId) || allWs[0];
        setWorkspaceState(active);
      } else {
        const newRef = doc(collection(db, 'workspaces'));
        const newWs = { name: "Personal Focus", ownerId: u.uid, members: [u.email].filter(Boolean) as string[], createdAt: serverTimestamp() };
        await setDoc(newRef, newWs);

        // Bootstrap owner member document
        const memberId = `${newRef.id}_${u.uid}`;
        await setDoc(doc(db, 'workspace_members', memberId), {
          id: memberId,
          workspaceId: newRef.id,
          userId: u.uid,
          email: u.email || "",
          displayName: u.displayName || "",
          role: "owner",
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        const created = { id: newRef.id, ...newWs } as Workspace;
        setWorkspaces([created]);
        setWorkspaceState(created);
        localStorage.setItem('activeWorkspaceId', created.id);
      }
    } catch (e) {
      console.error("Failed in loadWorkspaces master routine:", e instanceof Error ? e.message : e);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await loadWorkspaces(u);
      } else {
        setWorkspaceState(null);
        setWorkspaces([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const setWorkspace = (ws: Workspace | null) => {
    if (ws) {
        localStorage.setItem('activeWorkspaceId', ws.id);
    } else {
        localStorage.removeItem('activeWorkspaceId');
    }
    setWorkspaceState(ws);
    // Reload to re-fetch all queries with new workspaceId
    window.location.reload();
  };

  const reloadWorkspaces = async () => {
    if (user) await loadWorkspaces(user);
  };

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, workspace, workspaces, setWorkspace, loading, signIn, logOut, reloadWorkspaces }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);


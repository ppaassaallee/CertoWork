import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { Folder, Plus, Check, MoreVertical, UserPlus, Trash2, Edit2 } from "lucide-react";
import { setDoc, collection, doc, serverTimestamp, updateDoc, arrayUnion, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export function WorkspaceSwitcher({ isMobile = false, isCollapsed = false }: { isMobile?: boolean, isCollapsed?: boolean }) {
  const { user, workspace, workspaces, setWorkspace, reloadWorkspaces } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [editingWsName, setEditingWsName] = useState("");

  if (!workspace) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim() || !user) return;
    
    try {
      const newRef = doc(collection(db, 'workspaces'));
      const newWs = { name: newWsName.trim(), ownerId: user.uid, members: [user.email].filter(Boolean) as string[], createdAt: serverTimestamp() };
      await setDoc(newRef, newWs);

      const memberId = `${newRef.id}_${user.uid}`;
      await setDoc(doc(db, 'workspace_members', memberId), {
        id: memberId,
        workspaceId: newRef.id,
        userId: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        role: "owner",
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await reloadWorkspaces();
      setIsCreating(false);
      setNewWsName("");
      setIsOpen(false);
      // Automatically switch to it
      setWorkspace({ id: newRef.id, ...newWs });
    } catch (err) {
      console.error(err);
      alert("Failed to create workspace");
    }
  };

  const handleRename = async (wsId: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await updateDoc(doc(db, 'workspaces', wsId), { name: newName.trim() });
      await reloadWorkspaces();
      setEditingWsId(null);
      setEditingWsName("");
    } catch (err) {
      console.error(err);
      alert("Failed to rename workspace");
    }
  };

  const handleDelete = async (wsId: string, wsName: string) => {
    if (!confirm(`Are you sure you want to delete ${wsName}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'workspaces', wsId));
      await reloadWorkspaces();
      if (workspace?.id === wsId) {
          const nextWs = workspaces.find(w => w.id !== wsId);
          if (nextWs) setWorkspace(nextWs);
          else setWorkspace(null);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete workspace");
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !workspace) return;
    
    try {
      const wsRef = doc(db, 'workspaces', workspace.id);
      await updateDoc(wsRef, {
        members: arrayUnion(inviteEmail.trim().toLowerCase())
      });
      await reloadWorkspaces();
      setIsInviting(false);
      setInviteEmail("");
      alert(`Invited ${inviteEmail.trim()} to ${workspace.name}`);
    } catch (err) {
      console.error(err);
      alert("Failed to invite person");
    }
  };

  return (
    <div className={`relative ${isMobile ? 'px-4 py-2 border-b border-gray-100' : isCollapsed ? 'px-2 mb-4' : 'px-4 mb-4'}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 p-2 rounded-xl border border-gray-200 transition-colors"
        title={isCollapsed ? workspace.name : ""}
      >
        <div className="flex items-center gap-2 overflow-hidden truncate">
          <div className="bg-black text-white p-1.5 rounded-lg flex-shrink-0">
            <Folder className="w-3.5 h-3.5" />
          </div>
          {!isCollapsed && <span className="font-semibold text-sm truncate">{workspace.name}</span>}
        </div>
        {!isCollapsed && <MoreVertical className="w-4 h-4 text-gray-400" />}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className={`absolute z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden py-1 ${isMobile ? 'left-4 right-4' : isCollapsed ? 'left-0 w-56 ml-2' : 'left-4 w-56'}`}>
            <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest">Your Focuses</div>
            
            <div className="max-h-48 overflow-y-auto">
              {workspaces.map(ws => (
                <div
                  key={ws.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                >
                  {editingWsId === ws.id ? (
                    <div className="flex gap-1 w-full">
                        <input 
                            autoFocus
                            value={editingWsName}
                            onChange={(e) => setEditingWsName(e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded p-1"
                        />
                        <button onClick={() => handleRename(ws.id, editingWsName)} className="text-green-600">Save</button>
                    </div>
                  ) : (
                    <>
                        <button 
                            onClick={() => {
                                setWorkspace(ws);
                                setIsOpen(false);
                            }}
                            className="flex-1 text-left truncate"
                        >
                            <span className="truncate pr-2">{ws.name}</span>
                        </button>
                        <div className="flex items-center gap-1">
                            <button onClick={() => { setEditingWsId(ws.id); setEditingWsName(ws.name); }} className="p-1 hover:bg-gray-200 rounded">
                                <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                            <button onClick={() => handleDelete(ws.id, ws.name)} className="p-1 hover:bg-gray-200 rounded">
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                            {ws.id === workspace.id && <Check className="w-4 h-4 text-black flex-shrink-0" />}
                        </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 mt-1 pt-1">
              {isCreating ? (
                <form onSubmit={handleCreate} className="px-2 py-1">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Focus Name..."
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded p-1 mb-1 focus:outline-black"
                  />
                  <div className="flex gap-1 justify-end">
                    <button type="button" onClick={() => setIsCreating(false)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900">Cancel</button>
                    <button type="submit" disabled={!newWsName.trim()} className="px-2 py-1 text-xs bg-black text-white rounded disabled:opacity-50">Create</button>
                  </div>
                </form>
              ) : (
                <button 
                  onClick={() => setIsCreating(true)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-600"
                >
                  <Plus className="w-4 h-4" />
                  New Focus
                </button>
              )}

              {isInviting ? (
                <form onSubmit={handleInvite} className="px-2 py-1 border-t border-gray-50 mt-1">
                  <input
                    autoFocus
                    type="email"
                    placeholder="teammate@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded p-1 mb-1 focus:outline-black"
                  />
                  <div className="flex gap-1 justify-end">
                    <button type="button" onClick={() => setIsInviting(false)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900">Cancel</button>
                    <button type="submit" disabled={!inviteEmail.trim()} className="px-2 py-1 text-xs bg-black text-white rounded disabled:opacity-50">Invite</button>
                  </div>
                </form>
              ) : (
                <button 
                  onClick={() => setIsInviting(true)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-600"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite to {workspace.name}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { Users, Mail, UserMinus, Plus, ArrowLeft, Loader2, Edit3 } from "./ui/Icon";
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { getRoleForUser, canPerform } from "../lib/permissions";

export function WorkspaceSettings() {
  const { user, workspace, reloadWorkspaces } = useAuth();
  const navigate = useNavigate();
  const [currentWs, setCurrentWs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [wsName, setWsName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Member");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("success");

  useEffect(() => {
    if (!workspace) return;
    setLoading(true);
    const unsub = onSnapshot(doc(db, "workspaces", workspace.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCurrentWs({ id: snap.id, ...data });
        setWsName(data.name || "");
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return unsub;
  }, [workspace]);

  const showFeedback = (msg: string, type: "success" | "error" = "success") => {
    setFeedback(msg);
    setFeedbackType(type);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName.trim() || !workspace) return;
    try {
      await updateDoc(doc(db, "workspaces", workspace.id), {
        name: wsName.trim()
      });
      setIsRenaming(false);
      await reloadWorkspaces();
      showFeedback("Workspace renamed successfully!", "success");
    } catch (err: any) {
      showFeedback("Failed to rename workspace: " + err.message, "error");
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !workspace || !currentWs) return;
    const emailLower = inviteEmail.trim().toLowerCase();

    // Prevent duplicate emails
    if (currentWs.members && currentWs.members.includes(emailLower)) {
      showFeedback("User is already a member of this workspace.", "error");
      return;
    }

    try {
      const rolesMap = currentWs.roles || {};
      rolesMap[emailLower] = inviteRole;

      await updateDoc(doc(db, "workspaces", workspace.id), {
        members: arrayUnion(emailLower),
        roles: rolesMap
      });

      setInviteEmail("");
      await reloadWorkspaces();
      showFeedback(`Successfully invited ${emailLower} as ${inviteRole}.`, "success");
    } catch (err: any) {
      showFeedback("Failed to invite member: " + err.message, "error");
    }
  };

  const handleRemoveMember = async (email: string) => {
    if (!currentWs || !workspace) return;
    const emailLower = email.toLowerCase();
    
    // Safety check: Don't let owner remove themselves or if they're not owner
    const isOwner = currentWs.ownerId === user?.uid;
    if (user?.email?.toLowerCase() === emailLower) {
      showFeedback("You cannot remove yourself from the workspace.", "error");
      return;
    }

    if (!isOwner) {
      showFeedback("Only the workspace owner can remove members.", "error");
      return;
    }

    if (window.confirm(`Are you sure you want to remove ${email} from this workspace?`)) {
      try {
        const rolesMap = { ...(currentWs.roles || {}) };
        delete rolesMap[emailLower];

        await updateDoc(doc(db, "workspaces", workspace.id), {
          members: arrayRemove(emailLower),
          roles: rolesMap
        });

        await reloadWorkspaces();
        showFeedback(`Removed ${emailLower} from workspace.`, "success");
      } catch (err: any) {
        showFeedback("Failed to remove member: " + err.message, "error");
      }
    }
  };

  const handleChangeRole = async (email: string, newRole: string) => {
    if (!currentWs || !workspace) return;
    const emailLower = email.toLowerCase();
    
    if (currentWs.ownerId !== user?.uid) {
      showFeedback("Only the workspace owner can change member roles.", "error");
      return;
    }

    try {
      const rolesMap = { ...(currentWs.roles || {}) };
      rolesMap[emailLower] = newRole;

      await updateDoc(doc(db, "workspaces", workspace.id), {
        roles: rolesMap
      });

      showFeedback(`Updated ${emailLower} to ${newRole}.`, "success");
    } catch (err: any) {
      showFeedback("Failed to update role: " + err.message, "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--status-warning-soft)]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const userRole = getRoleForUser(currentWs, user?.email, user?.uid);
  const canUpdateWorkspace = canPerform(userRole, 'workspace.update');
  const canInvite = canPerform(userRole, 'member.invite');
  const canRemove = canPerform(userRole, 'member.remove');
  const canUpdateRole = canPerform(userRole, 'member.updateRole');
  const membersList = currentWs?.members || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-4 max-w-2xl mx-auto pb-24"
    >
      <header className="mb-8 mt-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/settings")}
          className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Workspace Settings & Team
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage team members, roles, and focus workspace permissions.</p>
        </div>
      </header>

      {/* Feedback Banner */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl text-sm font-medium mb-6 ${
              feedbackType === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-red-50 text-red-800 border border-red-100"
            }`}
          >
            {feedback}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {/* Rename Workspace Block */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Workspace Focus Area</h2>
          {isRenaming ? (
            <form onSubmit={handleRename} className="flex gap-2">
              <input
                type="text"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!wsName.trim()}
                className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setIsRenaming(false); setWsName(currentWs?.name || ""); }}
                className="border border-gray-200 text-gray-500 px-4 py-2 rounded-xl text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-gray-900">{currentWs?.name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Your Workspace Role: <span className="font-semibold text-indigo-650">{userRole}</span>
                </p>
              </div>
              {canUpdateWorkspace && (
                <button
                  onClick={() => setIsRenaming(true)}
                  className="p-2 hover:bg-gray-50 rounded-xl text-gray-500 hover:text-black transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </section>

        {/* Invite Teammates Block */}
        {canInvite ? (
          <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Invite Collaborator</h2>
            <p className="text-xs text-gray-500">Provide their Google-authenticated email address to grant collaborative access.</p>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  required
                  type="email"
                  placeholder="teammate@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
              >
                <option value="Member">Member</option>
                <option value="Admin">Admin</option>
                <option value="Project Manager">Project Manager</option>
                <option value="Contributor">Contributor</option>
                <option value="Viewer">Viewer</option>
              </select>
              <button
                type="submit"
                disabled={!inviteEmail.trim()}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Invite
              </button>
            </form>
          </section>
        ) : (
          <section className="bg-gray-50 rounded-2xl border border-gray-200/60 p-6 shadow-inner text-center">
            <p className="text-sm text-gray-500">You do not have permissions to invite collaborators to this workspace.</p>
          </section>
        )}

        {/* Members List Block */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Active Teammates ({membersList.length + 1})</h2>
          <div className="divide-y divide-gray-100">
            {/* Owner Row */}
            <div className="py-4 flex items-center justify-between first:pt-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm uppercase border border-indigo-100">
                  OW
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Owner</p>
                  <p className="text-xs text-gray-400">Workspace Creator</p>
                </div>
              </div>
              <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold px-2 py-1 rounded-lg">Owner</span>
            </div>

            {/* Invited Members Rows */}
            {membersList.map((email: string) => {
              const role = currentWs?.roles?.[email.toLowerCase()] || "Member";
              return (
                <div key={email} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-600 flex items-center justify-center font-black text-sm uppercase border border-gray-100">
                      {email.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{email}</p>
                      <p className="text-xs text-gray-400">Collaborator</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canUpdateRole ? (
                      <select
                        value={role}
                        onChange={(e) => handleChangeRole(email, e.target.value)}
                        className="bg-transparent border border-gray-200 rounded-lg text-xs font-semibold px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="Member">Member</option>
                        <option value="Admin">Admin</option>
                        <option value="Project Manager">Project Manager</option>
                        <option value="Contributor">Contributor</option>
                        <option value="Viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="text-xs bg-gray-50 text-gray-700 border border-gray-100 font-bold px-2 py-1 rounded-lg uppercase">{role}</span>
                    )}

                    {canRemove && (
                      <button
                        onClick={() => handleRemoveMember(email)}
                        className="p-1 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500 transition-colors"
                        title="Remove Member"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {membersList.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4 italic">No other teammates invited yet. Focus workspaces are private to you by default.</p>
            )}
          </div>
        </section>
      </div>
    </motion.div>
  );
}

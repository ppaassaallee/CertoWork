import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/AuthContext";

export type CollabWorkspaceSettings = {
  whoCanCreateGroups: "all" | "admins";
  guestInvitesEnabled: boolean;
  guestInviteExpiryDays: number;
  retention: "never" | "12m";
};

const DEFAULTS: CollabWorkspaceSettings = {
  whoCanCreateGroups: "all",
  guestInvitesEnabled: true,
  guestInviteExpiryDays: 30,
  retention: "never",
};

export function useCollabWorkspaceSettings(workspaceId?: string | null) {
  const [settings, setSettings] = useState<CollabWorkspaceSettings>(DEFAULTS);
  useEffect(() => {
    if (!workspaceId) return;
    return onSnapshot(doc(db, "workspace_settings", workspaceId), (snap) => {
      const collab = snap.exists()
        ? (snap.data() as { collab?: Partial<CollabWorkspaceSettings> }).collab
        : undefined;
      setSettings({ ...DEFAULTS, ...(collab || {}) });
    });
  }, [workspaceId]);

  const save = async (patch: Partial<CollabWorkspaceSettings>) => {
    if (!workspaceId) return;
    await setDoc(
      doc(db, "workspace_settings", workspaceId),
      { collab: { ...settings, ...patch } },
      { merge: true },
    );
  };

  return { settings, save };
}

export function CollabSettingsPanel({ workspaceId }: { workspaceId: string }) {
  const { settings, save } = useCollabWorkspaceSettings(workspaceId);
  const { user } = useAuth();
  if (!user) return null;
  return (
    <section className="do-collab-settings" data-testid="collab-settings">
      <h3>Collab</h3>
      <label>
        Who may create groups / DMs
        <select
          onChange={(e) =>
            void save({ whoCanCreateGroups: e.target.value as "all" | "admins" })
          }
          value={settings.whoCanCreateGroups}
        >
          <option value="all">All members</option>
          <option value="admins">Admins only</option>
        </select>
      </label>
      <label>
        <input
          checked={settings.guestInvitesEnabled}
          onChange={(e) => void save({ guestInvitesEnabled: e.target.checked })}
          type="checkbox"
        />
        Guest invitations
      </label>
      <label>
        Retention
        <select
          onChange={(e) =>
            void save({ retention: e.target.value as "never" | "12m" })
          }
          value={settings.retention}
        >
          <option value="never">Never delete</option>
          <option value="12m">12 months</option>
        </select>
      </label>
    </section>
  );
}

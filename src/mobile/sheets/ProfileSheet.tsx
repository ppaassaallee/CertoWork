import { MListRow, MSheet } from "../ui";

export function ProfileSheet({
  open,
  onClose,
  name,
  email,
  workspaceName,
  isAdmin,
  onNavigate,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  email: string;
  workspaceName: string;
  isAdmin?: boolean;
  onNavigate: (to: string) => void;
  onSignOut: () => void;
}) {
  return (
    <MSheet onClose={onClose} open={open} title="Profile">
      <div style={{ marginBottom: 12 }}>
        <strong>{name}</strong>
        <div className="m-caption">{email}</div>
        <div className="m-caption">{workspaceName}</div>
      </div>
      <MListRow
        onClick={() => {
          onClose();
          onNavigate("/settings");
        }}
        title="Settings"
      />
      {isAdmin ? (
        <MListRow
          onClick={() => {
            onClose();
            onNavigate("/settings");
          }}
          title="Admin & settings"
        />
      ) : null}
      <MListRow
        onClick={() => {
          onClose();
          onNavigate("/collab");
        }}
        title="Conversations"
      />
      <MListRow onClick={onSignOut} title="Sign out" />
    </MSheet>
  );
}

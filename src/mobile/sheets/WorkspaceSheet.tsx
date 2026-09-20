import { MListRow, MSheet } from "../ui";

export function WorkspaceSheet({
  open,
  onClose,
  workspaces,
  currentId,
  onSwitch,
}: {
  open: boolean;
  onClose: () => void;
  workspaces: Array<{ id: string; name: string }>;
  currentId?: string | null;
  onSwitch: (id: string) => void;
}) {
  return (
    <MSheet onClose={onClose} open={open} title="Workspaces">
      {workspaces.map((ws) => (
        <MListRow
          key={ws.id}
          meta={ws.id === currentId ? "✓" : undefined}
          onClick={() => {
            onSwitch(ws.id);
            onClose();
          }}
          title={ws.name}
        />
      ))}
      {!workspaces.length ? <p className="m-caption">No other workspaces.</p> : null}
    </MSheet>
  );
}

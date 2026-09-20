import { useEffect, useState } from "react";
import { MButton, MChip, MSegmented, MSheet } from "../ui";
import { useMobileChrome } from "../MobileChromeContext";

export type CreateKind = "item" | "project" | "note";

export function CreateSheet({
  open,
  onClose,
  defaultKind,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  defaultKind: CreateKind;
  onCreate: (payload: {
    kind: CreateKind;
    title: string;
    description: string;
    createAnother: boolean;
  }) => void | Promise<void>;
}) {
  const { setSheetOpen, setKeyboardUp } = useMobileChrome();
  const [kind, setKind] = useState<CreateKind>(defaultKind);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [another, setAnother] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setKind(defaultKind);
      setTitle("");
      setDescription("");
      setSheetOpen(true);
    } else {
      setSheetOpen(false);
      setKeyboardUp(false);
    }
  }, [open, defaultKind, setSheetOpen, setKeyboardUp]);

  const label =
    kind === "project" ? "Create project" : kind === "note" ? "Create note" : "Create item";

  return (
    <MSheet
      footer={
        <>
          <MButton
            disabled={!title.trim()}
            full
            loading={busy}
            onClick={() => {
              setBusy(true);
              void Promise.resolve(
                onCreate({
                  kind,
                  title: title.trim(),
                  description: description.trim(),
                  createAnother: another,
                }),
              )
                .then(() => {
                  if (another) {
                    setTitle("");
                    setDescription("");
                  } else onClose();
                })
                .finally(() => setBusy(false));
            }}
          >
            {label}
          </MButton>
          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginTop: 10,
              fontSize: 13,
              color: "var(--c-ink-2)",
            }}
          >
            <input checked={another} onChange={(e) => setAnother(e.target.checked)} type="checkbox" />
            Create another after this
          </label>
        </>
      }
      onClose={onClose}
      open={open}
      title="Create"
    >
      <MSegmented
        onChange={(id) => setKind(id as CreateKind)}
        options={[
          { id: "item", label: "Item" },
          { id: "project", label: "Project" },
          { id: "note", label: "Note" },
        ]}
        value={kind}
      />
      <div className="m-search-field" style={{ marginTop: 12 }}>
        <input
          autoFocus
          onBlur={() => setKeyboardUp(false)}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setKeyboardUp(true)}
          placeholder="Fix the timeout #bug @person tomorrow !high"
          value={title}
        />
      </div>
      <textarea
        onBlur={() => setKeyboardUp(false)}
        onChange={(e) => setDescription(e.target.value)}
        onFocus={() => setKeyboardUp(true)}
        placeholder="Description (optional)"
        rows={3}
        style={{
          width: "100%",
          marginTop: 10,
          border: "1px solid var(--c-line)",
          borderRadius: 10,
          padding: 12,
          fontSize: 16,
          fontFamily: "inherit",
          resize: "vertical",
        }}
        value={description}
      />
      <div className="m-chip-row">
        <MChip chevron>Project</MChip>
        <MChip chevron>Due</MChip>
        <MChip chevron>Priority</MChip>
        <MChip>Assignee: me</MChip>
      </div>
    </MSheet>
  );
}

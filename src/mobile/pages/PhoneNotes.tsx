import { useMemo, useState } from "react";
import { useMobileHeader } from "../MobileChromeContext";
import { MEmpty, MListRow, MSegmented } from "../ui";
import { formatDateRelative } from "../../shared/formatDate";

type Seg = "personal" | "team";

export function PhoneNotes({
  notes,
  onOpen,
  onCreate,
}: {
  notes: Array<{
    id: string;
    title: string;
    visibility?: string;
    updatedAt?: unknown;
    linkedLabel?: string;
  }>;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const [seg, setSeg] = useState<Seg>("personal");
  useMobileHeader({ title: "Notes" });

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      const v = String(n.visibility || "personal").toLowerCase();
      if (seg === "team") return v.includes("team") || v.includes("shared");
      return !v.includes("team");
    });
  }, [notes, seg]);

  return (
    <div className="m-phone-pad" data-testid="phone-notes">
      <MSegmented
        onChange={(id) => setSeg(id as Seg)}
        options={[
          { id: "personal", label: "Personal" },
          { id: "team", label: "Team" },
        ]}
        value={seg}
      />
      <div style={{ marginTop: 12 }}>
        {filtered.map((n) => (
          <MListRow
            key={n.id}
            onClick={() => onOpen(n.id)}
            subtitle={[formatDateRelative(n.updatedAt as never), n.linkedLabel]
              .filter(Boolean)
              .join(" · ")}
            title={n.title || "Untitled"}
            twoLine
          />
        ))}
        {!filtered.length ? (
          <MEmpty actionLabel="Create note" onAction={onCreate} title="No notes yet. Tap + to write one." />
        ) : null}
      </div>
    </div>
  );
}

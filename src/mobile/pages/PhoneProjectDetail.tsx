import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Sparkles } from "../../components/ui/Icon";
import { useMobileHeader } from "../MobileChromeContext";
import { MButton, MChip, MEmpty, MListRow, MSegmented } from "../ui";
import { formatDate } from "../../shared/formatDate";

export type PhoneProjectItem = {
  id: string;
  title: string;
  status?: string;
  dueDate?: string | null;
  projectId?: string | null;
};

type Seg = "overview" | "items" | "notes";

export function PhoneProjectDetail({
  projectId,
  project,
  items = [],
  notes = [],
  onOpenItem,
  onOpenNote,
  onAskOdysseus,
}: {
  projectId: string;
  project?: {
    id: string;
    title: string;
    stage?: string;
    health?: string;
    owner?: string;
    nextCheckpoint?: unknown;
    updatedAt?: unknown;
  } | null;
  items?: PhoneProjectItem[];
  notes?: Array<{ id: string; title: string; projectId?: string | null }>;
  onOpenItem: (id: string) => void;
  onOpenNote: (id: string) => void;
  onAskOdysseus?: () => void;
}) {
  const navigate = useNavigate();
  const [seg, setSeg] = useState<Seg>("overview");
  const title = project?.title || "Project";

  useMobileHeader({
    title,
    subtitle: project?.stage || undefined,
  });

  const projectItems = useMemo(
    () => items.filter((i) => String(i.projectId || "") === projectId),
    [items, projectId],
  );
  const projectNotes = useMemo(
    () => notes.filter((n) => String(n.projectId || "") === projectId),
    [notes, projectId],
  );

  if (!project) {
    return (
      <div className="m-phone-pad" data-testid="phone-project-missing">
        <button
          type="button"
          className="m-link-back"
          onClick={() => navigate("/projects")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            border: "none",
            background: "transparent",
            color: "#2547C4",
            padding: 0,
            marginBottom: 12,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <ChevronLeft size={18} /> Projects
        </button>
        <MEmpty title="Project not found" actionLabel="Back to Projects" onAction={() => navigate("/projects")} />
      </div>
    );
  }

  return (
    <div className="m-phone-pad" data-testid="phone-project-detail">
      <button
        type="button"
        onClick={() => navigate("/projects")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          border: "none",
          background: "transparent",
          color: "#2547C4",
          padding: 0,
          marginBottom: 8,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        <ChevronLeft size={18} /> Projects
      </button>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {project.stage ? <MChip selected>{project.stage}</MChip> : null}
          {project.health ? <MChip>{project.health}</MChip> : null}
          {project.owner ? <MChip>{project.owner}</MChip> : null}
        </div>
        {project.nextCheckpoint ? (
          <p className="m-caption" style={{ margin: 0 }}>
            Next checkpoint · {formatDate(project.nextCheckpoint as never)}
          </p>
        ) : null}
      </div>

      <MSegmented
        value={seg}
        onChange={(id) => setSeg(id as Seg)}
        options={[
          { id: "overview", label: "Overview" },
          { id: "items", label: `Items (${projectItems.length})` },
          { id: "notes", label: "Notes" },
        ]}
      />

      {seg === "overview" ? (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div className="m-card">
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>At a glance</h3>
            <p className="m-caption" style={{ margin: 0 }}>
              {projectItems.length} open items
              {projectNotes.length ? ` · ${projectNotes.length} notes` : ""}
            </p>
          </div>
          {projectItems.slice(0, 5).map((item) => (
            <MListRow
              key={item.id}
              twoLine
              title={item.title}
              subtitle={[item.status, item.dueDate ? formatDate(item.dueDate) : ""]
                .filter(Boolean)
                .join(" · ")}
              onClick={() => onOpenItem(item.id)}
            />
          ))}
          {!projectItems.length ? (
            <MEmpty title="No items yet" actionLabel="Add item" onAction={() => setSeg("items")} />
          ) : null}
          {onAskOdysseus ? (
            <MButton variant="secondary" full onClick={onAskOdysseus} icon={<Sparkles size={16} />}>
              Ask Odysseus about this project
            </MButton>
          ) : null}
        </div>
      ) : null}

      {seg === "items" ? (
        <div style={{ marginTop: 12 }}>
          {projectItems.length ? (
            projectItems.map((item) => (
              <MListRow
                key={item.id}
                twoLine
                title={item.title}
                subtitle={[item.status, item.dueDate ? formatDate(item.dueDate) : ""]
                  .filter(Boolean)
                  .join(" · ")}
                onClick={() => onOpenItem(item.id)}
              />
            ))
          ) : (
            <MEmpty title="No items in this project" />
          )}
        </div>
      ) : null}

      {seg === "notes" ? (
        <div style={{ marginTop: 12 }}>
          {projectNotes.length ? (
            projectNotes.map((n) => (
              <MListRow key={n.id} title={n.title} onClick={() => onOpenNote(n.id)} />
            ))
          ) : (
            <MEmpty title="No notes linked here" />
          )}
        </div>
      ) : null}
    </div>
  );
}

import type { DirectionProjectAttention, DirectionTone } from "../buildDirectionData";
import {
  DirectionDot,
  DirectionEmpty,
  DirectionRow,
  DirectionWidget,
} from "./DirectionWidget";

const TONE_COLOR: Record<DirectionTone, string> = {
  danger: "var(--status-danger)",
  warning: "var(--status-warning)",
  ok: "var(--status-success)",
  neutral: "var(--text-muted)",
};

export function ProjectsAttentionWidget({
  title,
  linkLabel,
  emptyLabel,
  footerLabel,
  rows,
  onOpen,
  onOpenProject,
}: {
  title: string;
  linkLabel: string;
  emptyLabel: string;
  footerLabel: string;
  rows: DirectionProjectAttention[];
  onOpen(): void;
  onOpenProject(projectId: string): void;
}) {
  return (
    <DirectionWidget linkLabel={linkLabel} onLink={onOpen} testId="direction-projects" title={title}>
      {rows.length === 0 ? (
        <DirectionEmpty label={emptyLabel} />
      ) : (
        <>
          {rows.map((row) => (
            <DirectionRow
              key={row.projectId}
              leading={<DirectionDot color={TONE_COLOR[row.tone]} />}
              meta={row.detail}
              metaTone={row.tone}
              onClick={() => onOpenProject(row.projectId)}
              title={row.name}
            />
          ))}
          {footerLabel ? <p className="cw-dir-footer">{footerLabel}</p> : null}
        </>
      )}
    </DirectionWidget>
  );
}

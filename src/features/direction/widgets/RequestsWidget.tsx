import type { DirectionData } from "../buildDirectionData";
import {
  DirectionAvatar,
  DirectionEmpty,
  DirectionRow,
  DirectionWidget,
} from "./DirectionWidget";

export function RequestsWidget({
  title,
  linkLabel,
  emptyLabel,
  data,
  labels,
  onOpen,
  onOpenItem,
}: {
  title: string;
  linkLabel: string;
  emptyLabel: string;
  data: DirectionData["requests"];
  labels: {
    unanswered: string;
    older: string;
    tickets: string;
    critical: string;
  };
  onOpen(): void;
  onOpenItem(id: string): void;
}) {
  const hasSignal =
    data.unanswered > 0 || data.ticketsOpen > 0 || data.top.length > 0;

  return (
    <DirectionWidget linkLabel={linkLabel} onLink={onOpen} testId="direction-requests" title={title}>
      {!hasSignal ? (
        <DirectionEmpty label={emptyLabel} />
      ) : (
        <>
          <div className="cw-dir-money-grid is-two">
            <div>
              <div className="cw-dir-big">{data.unanswered}</div>
              <div className="cw-dir-sub">
                {labels.unanswered}
                {data.olderThan48h > 0 ? (
                  <>
                    {" · "}
                    <span className="is-warning">
                      {data.olderThan48h} {labels.older}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <div>
              <div className="cw-dir-big">{data.ticketsOpen}</div>
              <div className="cw-dir-sub">
                {labels.tickets}
                {data.ticketsCritical > 0
                  ? ` · ${data.ticketsCritical} ${labels.critical}`
                  : null}
              </div>
            </div>
          </div>
          {data.top.map((row) => (
            <DirectionRow
              key={row.id}
              leading={<DirectionAvatar name={row.owner || row.title} />}
              meta={row.ageLabel}
              metaTone={row.tone}
              onClick={() => onOpenItem(row.id)}
              title={`${row.title} · ${row.owner}`}
            />
          ))}
        </>
      )}
    </DirectionWidget>
  );
}

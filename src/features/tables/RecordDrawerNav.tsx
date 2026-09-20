import { ChevronLeft, ChevronRight, ExternalLink, Sparkles } from "../../components/ui/Icon";

/** Header actions for the record drawer (prev/next + full page). */
export function RecordDrawerNav(props: {
  canPrev: boolean;
  canNext: boolean;
  onPrev(): void;
  onNext(): void;
  fullPageHref: string;
  onAskOdysseus?(): void;
}) {
  return (
    <div className="cw-record-drawer-nav" style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <button
        type="button"
        className="cw-tables-icon-btn"
        disabled={!props.canPrev}
        aria-label="Previous record"
        onClick={props.onPrev}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        className="cw-tables-icon-btn"
        disabled={!props.canNext}
        aria-label="Next record"
        onClick={props.onNext}
      >
        <ChevronRight size={16} />
      </button>
      <a
        href={props.fullPageHref}
        className="cw-tables-chip-btn"
        style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        <ExternalLink size={14} /> Open full page
      </a>
      {props.onAskOdysseus ? (
        <button type="button" className="cw-tables-chip-btn" onClick={props.onAskOdysseus}>
          <Sparkles size={14} /> Summarize
        </button>
      ) : null}
    </div>
  );
}

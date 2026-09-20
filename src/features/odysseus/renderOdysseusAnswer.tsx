import type { ReactNode } from "react";
import { DChip, DStatCard } from "../../desktop/ui";

export type OdysseusAnswerEntity = {
  type: string;
  id: string;
  label: string;
};

export type OdysseusAnswer = {
  text: string;
  entities?: OdysseusAnswerEntity[];
  highlights?: string | string[];
  stats?: Array<{
    key: string;
    label: string;
    value: string | number;
    tone?: "bad";
    href?: string;
  }>;
};

export function isStatusQuestion(q: string): boolean {
  const s = q.toLowerCase();
  return (
    s.includes("status") ||
    s.includes("how is") ||
    s.includes("how's") ||
    s.includes("summarize") ||
    s.includes("summary") ||
    s.includes("how does") ||
    s.includes("who pays")
  );
}

export function renderOdysseusAnswer(
  answer: OdysseusAnswer,
  onStatClick?: (href: string) => void,
): ReactNode {
  const highlights = Array.isArray(answer.highlights)
    ? answer.highlights
    : answer.highlights
      ? [answer.highlights]
      : [];

  return (
    <div className="ody-answer">
      <p style={{ margin: "0 0 8px", lineHeight: 1.45 }}>
        {answer.text}{" "}
        {(answer.entities || []).map((e) => (
          <DChip key={e.id}>{e.label}</DChip>
        ))}
      </p>
      {highlights.length ? (
        <>
          <h5 style={{ margin: "10px 0 6px", fontSize: 11, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--c-ink-2)" }}>
            Quick highlights
          </h5>
          {highlights.map((h, i) => (
            <p key={i} style={{ margin: "0 0 6px", fontSize: 13, color: "var(--c-ink-2)" }}>
              {h}
            </p>
          ))}
        </>
      ) : null}
      {answer.stats?.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          {answer.stats.slice(0, 4).map((s) => (
            <DStatCard
              bad={s.tone === "bad"}
              key={s.key}
              label={s.label}
              onClick={s.href ? () => onStatClick?.(s.href!) : undefined}
              value={s.value}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

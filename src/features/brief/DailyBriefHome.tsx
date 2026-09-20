import type { ReactNode } from "react";
import { DAvatarStack, DButton, DChip, DStatCard } from "../../desktop/ui";
import type { Brief, BriefHeadlinePart } from "./types";
import "./brief.css";

function HeadlineIcon({ kind }: { kind?: BriefHeadlinePart["kind"] }) {
  const map: Record<string, string> = {
    meetings: "📅",
    approvals: "📥",
    free: "☀",
    overdue: "⚠",
    invoices: "🧾",
  };
  if (!kind || kind === "text") return null;
  return <span className="brief-h-icon">{map[kind] || "·"}</span>;
}

function speakBrief(brief: Brief) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (import.meta.env.VITE_TTS_ENABLED === "0") return;
  const text = [
    brief.headline.parts.map((p) => p.text).join(""),
    brief.summary,
    ...brief.worthNoting.map((w) => w.text),
  ].join(". ");
  const u = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export type DailyBriefHomeProps = {
  workspaceName: string;
  memberLabels?: string[];
  brief: Brief | null;
  loading?: boolean;
  onRefresh: () => void;
  onCreate?: () => void;
  onPrepare?: (eventKey: string) => void;
  onOpenEvents?: () => void;
  onOpenInbox?: () => void;
  onStatClick?: (href: string) => void;
  listenVisible?: boolean;
};

export function DailyBriefHome({
  workspaceName,
  memberLabels = [],
  brief,
  loading,
  onRefresh,
  onCreate,
  onPrepare,
  onOpenEvents,
  onOpenInbox,
  onStatClick,
  listenVisible = true,
}: DailyBriefHomeProps) {
  const dateLine = brief
    ? new Date(brief.date + "T12:00:00").toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="brief-home d-root">
      <header className="brief-top">
        <div>
          <h1>
            Home <span className="muted">· {workspaceName}</span>
          </h1>
        </div>
        <div className="brief-top-actions">
          {memberLabels.length ? <DAvatarStack labels={memberLabels} /> : null}
          <DButton onClick={onCreate} size="sm">
            Create
          </DButton>
        </div>
      </header>

      <section className="brief-card">
        <div className="brief-card-head">
          <span className="brief-date">{dateLine}</span>
          <div className="brief-card-actions">
            {listenVisible && brief && typeof window !== "undefined" && "speechSynthesis" in window ? (
              <button className="brief-listen" onClick={() => speakBrief(brief)} type="button">
                Listen to your brief
              </button>
            ) : null}
            <button className="brief-refresh" onClick={onRefresh} type="button">
              {loading ? "Refreshing…" : "Refresh brief"}
            </button>
          </div>
        </div>
        {brief ? (
          <>
            <p className="brief-headline">
              {brief.headline.parts.map((p, i) =>
                p.kind && p.kind !== "text" ? (
                  <span className="brief-h-part" key={i}>
                    <HeadlineIcon kind={p.kind} />
                    <strong>{p.text}</strong>
                  </span>
                ) : (
                  <span className="brief-h-conn" key={i}>
                    {p.text}
                  </span>
                ),
              )}
            </p>
            <p className="brief-summary">{brief.summary}</p>
          </>
        ) : (
          <p className="brief-summary">{loading ? "Building your brief…" : "No brief yet."}</p>
        )}
      </section>

      {brief?.nextEvent ? (
        <section className="brief-next">
          <div>
            <h2>{brief.nextEvent.title}</h2>
            <p className="muted">
              {formatTime(brief.nextEvent.start)}
              {brief.nextEvent.provider ? ` · ${brief.nextEvent.provider}` : ""}
            </p>
            <StartsIn start={brief.nextEvent.start} />
          </div>
          <DButton onClick={() => onPrepare?.(brief.nextEvent!.eventKey)}>Prepare</DButton>
        </section>
      ) : null}

      {brief && brief.meetings.length > 0 ? (
        <section className="brief-section">
          <div className="brief-section-head">
            <h3>Upcoming meetings</h3>
            <button className="linkish" onClick={onOpenEvents} type="button">
              Events
            </button>
          </div>
          <ul className="brief-meet-list">
            {brief.meetings.map((m) => (
              <li key={m.eventKey}>
                <span>{m.title}</span>
                <span className="muted">{formatTime(m.start)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {brief && brief.worthNoting.length > 0 ? (
        <section className="brief-section">
          <div className="brief-section-head">
            <h3>Worth noting</h3>
            <button className="linkish" onClick={onOpenInbox} type="button">
              Inbox
            </button>
          </div>
          <ul className="brief-note-list">
            {brief.worthNoting.map((w, i) => (
              <li key={i}>
                <span>{w.text}</span>
                <span className="brief-chips">
                  {w.entities.map((e) => (
                    <DChip key={e.id}>{e.label}</DChip>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {brief ? (
        <section className="brief-section">
          <h3>This week</h3>
          <div className="brief-stats">
            {brief.stats.map((s) => (
              <DStatCard
                bad={s.tone === "bad"}
                key={s.key}
                label={s.label}
                onClick={() => onStatClick?.(s.href)}
                value={s.value}
              />
            ))}
          </div>
        </section>
      ) : null}

      {brief && brief.schedule.length > 0 ? (
        <section className="brief-section">
          <h3>Your schedule</h3>
          <ul className="brief-schedule">
            {brief.schedule.map((line, i) => (
              <li key={i}>
                {line.text}
                {line.entities.map((e) => (
                  <DChip key={e.id}>{e.label}</DChip>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function StartsIn({ start }: { start: string }) {
  const mins = Math.round((new Date(start).getTime() - Date.now()) / 60000);
  if (!Number.isFinite(mins) || mins > 24 * 60) return null;
  if (mins < 0) return <p className="starts-in">Started</p>;
  return (
    <p className={mins < 60 ? "starts-in is-soon" : "starts-in"}>
      Starts in {mins} min
    </p>
  );
}

export function BriefShell({ children }: { children: ReactNode }) {
  return <div className="brief-shell">{children}</div>;
}

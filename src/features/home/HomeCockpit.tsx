import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  CheckSquare,
  Flag,
  LayoutGrid,
  Sparkles,
} from "../../components/ui/Icon";
import { getLocale } from "../../lib/i18n";
import type { MyWorkActor } from "../../lib/myWorkItems";
import type { WorkspaceMember } from "../../lib/workspaceCollaboration";
import type { RecordDoc, TableDoc } from "../../lib/tables";
import {
  buildHomeCockpitData,
  type EditorialPart,
  type HomeActionRow,
  type HomeItemRow,
  type HomeRoutineHint,
} from "./buildHomeCockpitData";
import { useCalendarEvents } from "../calendar/useCalendarEvents";
import { eventDayKeys } from "../../lib/calendar/dates";
import "../calendar/calendarOverlay.css";
import { FocusRing } from "../dayplan/FocusRing";
import { useDayPlan } from "../dayplan/useDayPlan";
import { useDailyBriefEnabled, enableDailyBrief } from "../flags/featureUserFlags";
import {
  DailyBriefHome,
  PrepareSheet,
  useDailyBrief,
} from "../brief";
import { OdysseusSignalsPanel } from "../signals";
import "./home.css";

export type HomeCockpitProps = {
  userName: string;
  actor: MyWorkActor;
  tasks: any[];
  projects: any[];
  risks?: any[];
  members?: WorkspaceMember[];
  reviewItems?: any[];
  accessRequests?: any[];
  activityItems?: any[];
  routines?: HomeRoutineHint[];
  routinesRan7d?: number;
  /** Optional clock for Sunday/weekday polish screenshots. */
  now?: Date;
  routineSessions?: Array<{
    id: string;
    recipeId: string;
    status: string;
    estimatedMinutes?: number | null;
    condensed?: boolean;
    weekOf?: string;
  }>;
  weeklyPlanSession?: any | null;
  onOpenOdysseus: (opts?: { prompt?: string }) => void;
  onNew?: () => void;
  onOpenItem: (itemId: string) => void;
  onOpenRecord?: (tableId: string, recordId: string) => void;
  onOpenProject: (projectId: string) => void;
  onApprove: (item: any) => void;
  onRespondRequest: (request: any) => void;
  onOpenApprovals: () => void;
  onStartRitual?: (session: any) => void;
  onReviewFriday?: () => void;
  onOpenToday?: () => void;
  onOpenMyWork?: (filter: "today" | "overdue" | "week") => void;
  userId?: string;
  workspaceId?: string;
  dayPlanItems?: Array<{ id: string; status: "open" | "done" | "archived" }>;
  focusScore?: number;
  tables?: TableDoc[];
  records?: RecordDoc[];
};

function TypeGlyph({ type, entityKind }: { type: string; entityKind?: string }) {
  if (entityKind === "record" || type === "record") return <LayoutGrid size={12} />;
  const lower = type.toLowerCase();
  if (lower.includes("epic") || lower.includes("épica")) return <Bookmark size={12} />;
  if (lower.includes("bug")) return <AlertTriangle size={12} />;
  if (lower.includes("milestone") || lower.includes("hito")) return <Flag size={12} />;
  return <CheckSquare size={12} />;
}

function ActionIcon({ kind }: { kind: HomeActionRow["kind"] }) {
  if (kind === "approval") return <Sparkles size={14} />;
  if (kind === "request") return <AlertTriangle size={14} />;
  return <AlertTriangle size={14} />;
}

function ProgressRing({
  pct,
  health,
}: {
  pct: number;
  health: "on_track" | "at_risk" | "blocked";
}) {
  const r = 7.5;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * c;
  const stroke =
    health === "blocked"
      ? "var(--status-danger, #E24B4A)"
      : health === "at_risk"
        ? clamped === 0
          ? "var(--status-danger, #E24B4A)"
          : "var(--status-warning, #EF9F27)"
        : "var(--status-success, #639922)";
  return (
    <svg className="cw-home-ring" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 10 10)"
      />
    </svg>
  );
}

function EditorialLine({
  parts,
  onPart,
}: {
  parts: EditorialPart[];
  onPart: (part: EditorialPart) => void;
}) {
  return (
    <p className="cw-home-editorial" data-testid="home-day-line">
      <Sparkles size={14} className="cw-home-editorial-mark" aria-hidden />
      <span>
        {parts.map((part, index) =>
          part.tone === "link" || part.tone === "danger" ? (
            <button
              className={`cw-home-editorial-link ${part.tone === "danger" ? "is-danger" : ""}`}
              key={`${index}-${part.text}`}
              onClick={() => onPart(part)}
              type="button"
            >
              {part.text}
            </button>
          ) : (
            <span key={`${index}-${part.text}`}>{part.text}</span>
          ),
        )}
      </span>
    </p>
  );
}

export function HomeCockpit({
  userName,
  actor,
  tasks,
  projects,
  risks = [],
  members = [],
  reviewItems = [],
  accessRequests = [],
  activityItems = [],
  routines = [],
  routinesRan7d = 0,
  now,
  routineSessions = [],
  weeklyPlanSession = null,
  onOpenOdysseus,
  onOpenItem,
  onOpenRecord,
  onOpenProject,
  onApprove,
  onRespondRequest,
  onOpenApprovals,
  onStartRitual,
  onReviewFriday,
  onOpenToday,
  onOpenMyWork,
  userId,
  workspaceId,
  dayPlanItems = [],
  focusScore,
  tables = [],
  records = [],
}: HomeCockpitProps) {
  const locale = getLocale();
  const { events: calendarEvents } = useCalendarEvents();
  const day = useDayPlan({
    userId,
    workspaceId,
    items: dayPlanItems,
  });
  const scoreValue = day.score.value || focusScore || 0;
  const model = useMemo(
    () =>
      buildHomeCockpitData({
        userName,
        actor,
        tasks,
        projects,
        risks,
        members,
        reviewItems,
        accessRequests,
        activityItems,
        routines,
        routinesRan7d,
        routineSessions,
        now,
        locale,
        calendarEvents,
        tables,
        records,
      }),
    [
      userName,
      actor,
      tasks,
      projects,
      risks,
      members,
      reviewItems,
      accessRequests,
      activityItems,
      routines,
      routinesRan7d,
      routineSessions,
      now,
      locale,
      calendarEvents,
      tables,
      records,
    ],
  );

  const [itemTab, setItemTab] = useState<"today" | "overdue" | "week">(model.defaultItemTab);
  const [focusSection, setFocusSection] = useState<string | null>(null);

  useEffect(() => {
    setItemTab(model.defaultItemTab);
  }, [model.defaultItemTab]);

  const items: HomeItemRow[] =
    itemTab === "today"
      ? model.todayItems
      : itemTab === "overdue"
        ? model.overdueItems
        : model.weekItems;

  const showActions =
    focusSection !== "projects" &&
    (focusSection === "approvals" ||
      focusSection === "blocked" ||
      focusSection == null ||
      focusSection === "due" ||
      focusSection === "overdue");

  const handleEditorial = (part: EditorialPart) => {
    if (part.action === "overdue") {
      setItemTab("overdue");
      setFocusSection("overdue");
    } else if (part.action === "today") {
      setItemTab("today");
    } else if (part.action === "week") {
      setItemTab("week");
    } else if (part.action === "approvals") {
      onOpenApprovals();
    } else if (part.action === "project" && part.projectId) {
      onOpenProject(part.projectId);
    } else if (part.action === "plan") {
      onOpenOdysseus({
        prompt:
          locale === "es"
            ? "Ayudame a armar el Plan semanal del lunes"
            : "Help me draft Monday's weekly plan",
      });
    }
  };

  const emptyItemsLabel =
    itemTab === "today"
      ? locale === "es"
        ? "Nada asignado para hoy"
        : "Nothing assigned for today"
      : itemTab === "overdue"
        ? locale === "es"
          ? "Sin vencidos"
          : "No overdue items"
        : locale === "es"
          ? "Nada esta semana"
          : "Nothing this week";

  const triagePrompt =
    locale === "es"
      ? `Ayudame a triar mis ${model.overdueItems.length} vencidos`
      : `Help me triage my ${model.overdueItems.length} overdue items`;

  const dailyBriefOn = useDailyBriefEnabled();
  const dateKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const gather = useMemo(
    () => ({
      dateKey,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      meetings: (calendarEvents || []).slice(0, 8).map((e: any, i: number) => ({
        eventKey: String(e.id || e.eventKey || `ev-${i}`),
        title: String(e.title || e.summary || "Meeting"),
        start: String(e.start || e.startAt || dateKey),
        end: String(e.end || e.endAt || dateKey),
        provider: e.provider ? String(e.provider) : undefined,
      })),
      approvalCount: reviewItems.length + accessRequests.length,
      overdueCount: model.overdueItems.length,
      plannedToday: model.todayItems.length || dayPlanItems.length,
      focusScore: scoreValue || "—",
      blockedProjects: (projects || []).filter((p: any) =>
        String(p.status || p.health || "").toLowerCase().includes("block"),
      ).length,
      freeAfternoon: (calendarEvents || []).length <= 2,
      keyThread: model.todayItems[0]?.title,
      worthNoting: model.overdueItems.slice(0, 3).map((it) => ({
        text: `Overdue: ${it.title}`,
        entities: [{ type: "item" as const, id: it.id, label: it.title }],
        severity: "bad" as const,
      })),
      schedule: [],
    }),
    [
      dateKey,
      calendarEvents,
      reviewItems.length,
      accessRequests.length,
      model.overdueItems,
      model.todayItems,
      dayPlanItems.length,
      scoreValue,
      projects,
    ],
  );
  const { brief, loading: briefLoading, refresh: refreshBrief } = useDailyBrief({
    enabled: dailyBriefOn,
    uid: userId,
    gather,
  });
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [prepareTitle, setPrepareTitle] = useState("");

  if (dailyBriefOn) {
    return (
      <div className="cw-home" data-testid="home-cockpit-brief" style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
        <OdysseusSignalsPanel uid={userId} workspaceId={workspaceId} />
        <div style={{ flex: 1, minWidth: 0 }}>
        <DailyBriefHome
          brief={brief}
          loading={briefLoading}
          memberLabels={(members || []).slice(0, 4).map((m) => m.displayName || m.email || m.id)}
          onCreate={() => onOpenOdysseus()}
          onOpenEvents={() => onOpenOdysseus({ prompt: "Show my events today" })}
          onOpenInbox={onOpenApprovals}
          onPrepare={(key) => {
            const m = brief?.meetings.find((x) => x.eventKey === key) || brief?.nextEvent;
            setPrepareTitle(m?.title || "Meeting");
            setPrepareOpen(true);
          }}
          onRefresh={() => void refreshBrief(true)}
          onStatClick={() => undefined}
          workspaceName={workspaceId || "Workspace"}
        />
        <PrepareSheet
          linkedItems={model.todayItems.slice(0, 5).map((i) => ({ id: i.id, title: i.title }))}
          meetingTitle={prepareTitle}
          onAskOdysseus={() => onOpenOdysseus({ prompt: `Prepare me for ${prepareTitle}` })}
          onClose={() => setPrepareOpen(false)}
          onOpenProject={() => projects[0] && onOpenProject(projects[0].id)}
          open={prepareOpen}
          openItems={model.weekItems.slice(0, 5).map((i) => ({ id: i.id, title: i.title }))}
        />
        </div>
      </div>
    );
  }

  return (
    <div className="cw-home" data-testid="home-cockpit">
      {!dailyBriefOn && userId ? (
        <div
          className="cw-home-stagger"
          data-testid="daily-brief-optin"
          style={{
            ["--i" as string]: 0,
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            background: "color-mix(in srgb, var(--accent) 8%, transparent)",
          }}
        >
          <div>
            <strong style={{ display: "block" }}>Daily Brief</strong>
            <span className="cw-home-muted" style={{ fontSize: 13 }}>
              Template-first morning plan, Prepare sheet, and Odysseus signals.
            </span>
          </div>
          <button
            className="do-button"
            onClick={() => void enableDailyBrief(userId)}
            type="button"
          >
            Try Daily Brief
          </button>
        </div>
      ) : null}
      <header className="cw-home-header cw-home-stagger" style={{ ["--i" as string]: 0 }}>
        <p className="cw-home-date">{model.longDate}</p>
        <div className="cw-home-greeting-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ margin: 0 }}>{model.greeting}</h1>
          {(day.plan?.plannedItemIds.length || day.plan?.keyItemId) ? <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginLeft: "auto",
              color: "var(--text-muted)",
              fontSize: 11,
            }}
            title={locale === "es" ? "Focus score de hoy" : "Today focus score"}
          >
            <FocusRing
              label={locale === "es" ? "Focus score de hoy" : "Today focus score"}
              size="sm"
              value={scoreValue}
            />
            {scoreValue}%
          </span> : null}
        </div>
      </header>

      <div className="cw-home-stagger" style={{ ["--i" as string]: 1 }}>
        <EditorialLine parts={model.editorial} onPart={handleEditorial} />
        {model.nextMeetings.length > 0 ? (
          <div className="cw-home-meetings" data-testid="home-meetings-strip">
            {model.nextMeetings.map((meeting) => {
              const time = new Date(meeting.start).toLocaleTimeString(
                locale === "es" ? "es" : "en",
                { hour: "2-digit", minute: "2-digit" },
              );
              const platform = meeting.meetingUrl
                ? /teams/i.test(meeting.meetingUrl)
                  ? "Teams"
                  : "Meet"
                : "";
              return (
                <span className="cw-home-meeting-chip" key={meeting.id}>
                  {time} {meeting.title}
                  {platform ? ` · ${platform}` : ""}
                </span>
              );
            })}
            {model.nextMeetings[0]?.minutesUntil <= 60 ? (
              <button
                className="cw-home-meeting-prepare"
                onClick={() =>
                  onOpenOdysseus({
                    prompt:
                      locale === "es"
                        ? `Prepará la reunión “${model.nextMeetings[0].title}”`
                        : `Prepare for meeting “${model.nextMeetings[0].title}”`,
                  })
                }
                type="button"
              >
                {locale === "es"
                  ? `Tu próxima reunión en ${model.nextMeetings[0].minutesUntil} min · Preparar`
                  : `Your next meeting in ${model.nextMeetings[0].minutesUntil} min · Prepare`}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {showActions && model.actions.length > 0 &&
        (
          <section
            className="cw-home-card cw-home-stagger"
            data-testid="home-action-queue"
            style={{ ["--i" as string]: 3 }}
          >
            <div className="cw-home-card-head">
              <h2>{locale === "es" ? "Requiere tu acción" : "Needs your action"}</h2>
              <button onClick={onOpenApprovals} type="button">
                {model.actions.length} · {locale === "es" ? "Ver todo" : "See all"}
              </button>
            </div>
            <ul className="cw-home-action-list">
              {model.actions.map((row) => (
                <li key={row.id}>
                  <span className="cw-home-action-icon">
                    <ActionIcon kind={row.kind} />
                  </span>
                  <div className="cw-home-action-body">
                    <strong>{row.title}</strong>
                    <span>{row.meta}</span>
                  </div>
                  <button
                    className="cw-home-inline-action"
                    onClick={() => {
                      if (row.actionLabel === "approve") onApprove(row.payload);
                      else if (row.actionLabel === "respond") onRespondRequest(row.payload);
                      else if (row.actionLabel === "start") onStartRitual?.(row.payload);
                      else if (
                        row.kind === "blocked" &&
                        row.payload &&
                        (row.payload as HomeItemRow).id
                      ) {
                        onOpenItem((row.payload as HomeItemRow).id);
                      }
                    }}
                    type="button"
                  >
                    {row.actionLabel === "approve"
                      ? locale === "es"
                        ? "Aprobar"
                        : "Approve"
                      : row.actionLabel === "respond"
                        ? locale === "es"
                          ? "Responder"
                          : "Respond"
                        : row.actionLabel === "start"
                          ? locale === "es"
                            ? "Empezar"
                            : "Start"
                          : locale === "es"
                            ? "Abrir"
                            : "Open"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

      <section className="cw-home-card cw-home-today cw-home-stagger" data-testid="home-today-plan">
        <div className="cw-home-card-head">
          <h2>{locale === "es" ? "Hoy" : "Today"}</h2>
          {day.plan && day.score.planned > 0 ? (
            <span>{day.score.done} / {day.score.planned} {locale === "es" ? "hechos" : "done"}</span>
          ) : null}
        </div>
        {day.plan && (day.plan.keyItemId || day.plan.plannedItemIds.length > 0) ? (
          <div className="cw-home-today-content">
            <div>
              <span className="cw-home-today-caption">{locale === "es" ? "Tu prioridad" : "Your priority"}</span>
              <strong>{tasks.find((task) => String(task.id) === day.plan?.keyItemId)?.title || (locale === "es" ? "Elegir prioridad" : "Choose a priority")}</strong>
            </div>
            <button className="cw-home-today-link" onClick={onOpenToday} type="button">{locale === "es" ? "Abrir mi día" : "Open my day"} →</button>
          </div>
        ) : (
          <div className="cw-home-today-content">
            <p>{locale === "es" ? "Elige lo más importante para hoy." : "Choose what matters most today."}</p>
            <button className="cw-home-today-link" onClick={onOpenToday} type="button">{locale === "es" ? "Planear hoy · 5 min" : "Plan today · 5 min"} →</button>
          </div>
        )}
        {weeklyPlanSession && onReviewFriday ? <button className="cw-home-weekly-link" onClick={onReviewFriday} type="button">{locale === "es" ? "Revisar la semana" : "Review the week"}</button> : null}
      </section>

      <div className="cw-home-split cw-home-stagger" style={{ ["--i" as string]: 4 }}>
        <section className="cw-home-card" data-testid="home-my-items">
          <div className="cw-home-card-head cw-home-tabs">
            <h2>{locale === "es" ? "Mi trabajo" : "My work"}</h2>
            <div className="cw-home-tab-row">
              {(
                [
                  ["today", locale === "es" ? "Hoy" : "Today", model.todayItems.length, false],
                  [
                    "overdue",
                    locale === "es" ? "Vencidos" : "Overdue",
                    model.overdueItems.length,
                    true,
                  ],
                  ["week", locale === "es" ? "Semana" : "Week", model.weekItems.length, false],
                ] as const
              ).map(([id, label, count, danger]) => (
                <button
                  className={`${itemTab === id ? "is-active" : ""} ${danger && count > 0 ? "is-danger" : ""}`}
                  key={id}
                  onClick={() => setItemTab(id)}
                  type="button"
                >
                  {label} {count}
                </button>
              ))}
            </div>
          </div>
          {items.length === 0 ? (
            <p className="cw-home-empty-line">{emptyItemsLabel}</p>
          ) : (
            <>
              <ul className="cw-home-item-list">
                {items.slice(0, 5).map((item) => (
                  <li key={`${item.entityKind || "task"}-${item.id}`}>
                    <button
                      onClick={() => {
                        if (item.entityKind === "record" && item.tableId && onOpenRecord) {
                          onOpenRecord(item.tableId, item.id);
                          return;
                        }
                        onOpenItem(item.id);
                      }}
                      type="button"
                    >
                      <TypeGlyph entityKind={item.entityKind} type={item.workItemType} />
                      <span className="cw-home-item-main">
                        <strong title={item.title}>{item.title}</strong>
                        <em>
                          {[item.projectTitle, item.status].filter(Boolean).join(" · ")}
                        </em>
                      </span>
                      {item.ageLabel ? (
                        <span
                          className={`cw-home-due ${itemTab === "overdue" || (item.dueIso && item.dueIso < model.next7Days[0]?.iso) ? "is-urgent" : ""}`}
                        >
                          {item.ageLabel}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
              {items.length > 5 ? (
                <div className="cw-home-card-foot">
                  <button onClick={() => onOpenMyWork?.(itemTab)} type="button">
                    + {items.length - 5} {locale === "es" ? "más" : "more"} →
                  </button>
                  {model.overdueItems.length > 0 ? (
                    <button
                      onClick={() =>
                        onOpenOdysseus({
                          prompt: triagePrompt,
                        })
                      }
                      type="button"
                    >
                      {locale === "es" ? "Triage con Odysseus →" : "Triage with Odysseus →"}
                    </button>
                  ) : null}
                </div>
              ) : model.overdueItems.length > 0 && itemTab === "overdue" ? (
                <div className="cw-home-card-foot">
                  <span />
                  <button
                    onClick={() => onOpenOdysseus({ prompt: triagePrompt })}
                    type="button"
                  >
                    {locale === "es" ? "Triage con Odysseus →" : "Triage with Odysseus →"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="cw-home-card" data-testid="home-my-projects">
          <div className="cw-home-card-head">
            <h2>{locale === "es" ? "Mis proyectos" : "My projects"}</h2>
            <button onClick={() => setFocusSection("projects")} type="button">
              {model.projects.length} · {locale === "es" ? "ver todos" : "see all"}
            </button>
          </div>
          {model.projects.length === 0 ? (
            <p className="cw-home-empty-line">
              {locale === "es" ? "Sin proyectos activos" : "No active projects"}
            </p>
          ) : (
            <ul className="cw-home-project-list">
              {model.projects.map((project) => (
                <li key={project.id}>
                  <button
                    onClick={() => onOpenProject(project.id)}
                    title={project.title}
                    type="button"
                  >
                    <ProgressRing health={project.health} pct={project.pct} />
                    <span className="cw-home-project-main">
                      <strong>{project.shortName}</strong>
                      <em className={project.lineTone !== "muted" ? `is-${project.lineTone}` : undefined}>
                        {project.line}
                      </em>
                    </span>
                    <span className="cw-home-avatar" aria-hidden>
                      {project.ownerInitials}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section
        className="cw-home-card cw-home-stagger"
        data-testid="home-next-7"
        style={{ ["--i" as string]: 5 }}
      >
        <div className="cw-home-card-head">
          <h2>{locale === "es" ? "Próximos 7 días" : "Next 7 days"}</h2>
          <span>{model.weekSubtitle}</span>
        </div>
        <div className="cw-home-week-strip">
          {model.next7Days.map((day) => (
            <div
              className={`cw-home-week-day ${day.isToday ? "is-today" : ""} ${day.isWeekend ? "is-weekend" : ""}`}
              key={day.iso}
            >
              <span className="cw-home-week-label">
                <b>{day.dayNum}</b>
                {day.weekday}
                {day.isToday ? (
                  <i>{locale === "es" ? " · hoy" : " · today"}</i>
                ) : null}
              </span>
              <div className="cw-home-week-chips">
                {day.routines.map((routine) => (
                  <span className="cw-home-week-chip is-routine" key={routine.id}>
                    <Sparkles size={9} /> {routine.title}
                  </span>
                ))}
                {calendarEvents
                  .filter(
                    (event) =>
                      !event.allDay &&
                      event.privacy !== "busy" &&
                      eventDayKeys(event).includes(day.iso),
                  )
                  .slice(0, 3)
                  .map((event) => (
                    <span className="cw-home-week-chip is-event" key={event.id}>
                      {new Date(event.start).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      {event.title}
                    </span>
                  ))}
                {(() => {
                  const extra =
                    calendarEvents.filter(
                      (event) =>
                        !event.allDay &&
                        event.privacy !== "busy" &&
                        eventDayKeys(event).includes(day.iso),
                    ).length - 3;
                  return extra > 0 ? (
                    <span className="cw-home-week-chip is-event">+{extra}</span>
                  ) : null;
                })()}
                {day.items.slice(0, 3).map((item) => (
                  <button
                    className="cw-home-week-chip"
                    key={`${item.entityKind || "task"}-${item.id}`}
                    onClick={() => {
                      if (item.entityKind === "record" && item.tableId && onOpenRecord) {
                        onOpenRecord(item.tableId, item.id);
                        return;
                      }
                      onOpenItem(item.id);
                    }}
                    type="button"
                  >
                    <TypeGlyph entityKind={item.entityKind} type={item.workItemType} />
                    <span>{item.title}</span>
                  </button>
                ))}
                {day.restLabel ? (
                  <span className="cw-home-week-rest">{day.restLabel}</span>
                ) : null}
                {!day.items.length && !day.routines.length && !day.restLabel ? (
                  <span className="cw-home-week-dot" aria-hidden>
                    ·
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

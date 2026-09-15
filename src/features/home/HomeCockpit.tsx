import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  CheckSquare,
  Flag,
  Sparkles,
} from "../../components/ui/Icon";
import { getLocale } from "../../lib/i18n";
import type { MyWorkActor } from "../../lib/myWorkItems";
import type { WorkspaceMember } from "../../lib/workspaceCollaboration";
import {
  buildHomeCockpitData,
  type EditorialPart,
  type HomeActionRow,
  type HomeItemRow,
  type HomeRoutineHint,
} from "./buildHomeCockpitData";
import { MiSemanaCard } from "../routines/MiSemanaCard";
import { FocusRing } from "../dayplan/FocusRing";
import { useDayPlan } from "../dayplan/useDayPlan";
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
  onOpenProject: (projectId: string) => void;
  onApprove: (item: any) => void;
  onRespondRequest: (request: any) => void;
  onOpenApprovals: () => void;
  onStartRitual?: (session: any) => void;
  onReviewFriday?: () => void;
  userId?: string;
  workspaceId?: string;
  dayPlanItems?: Array<{ id: string; status: "open" | "done" | "archived" }>;
  focusScore?: number;
};

function TypeGlyph({ type }: { type: string }) {
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

function useCountUp(value: number, duration = 400) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setShown(Math.round(value * p));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return shown;
}

function QuietStatValue({ value, tone }: { value: number; tone: "plain" | "danger" }) {
  const shown = useCountUp(value);
  return <b className={tone === "danger" ? "is-danger" : undefined}>{shown}</b>;
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
  onOpenProject,
  onApprove,
  onRespondRequest,
  onOpenApprovals,
  onStartRitual,
  onReviewFriday,
  userId,
  workspaceId,
  dayPlanItems = [],
  focusScore,
}: HomeCockpitProps) {
  const locale = getLocale();
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

  return (
    <div className="cw-home" data-testid="home-cockpit">
      <header className="cw-home-header cw-home-stagger" style={{ ["--i" as string]: 0 }}>
        <p className="cw-home-date">{model.longDate}</p>
        <div className="cw-home-greeting-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ margin: 0 }}>{model.greeting}</h1>
          <span
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
          </span>
        </div>
      </header>

      <div className="cw-home-stagger" style={{ ["--i" as string]: 1 }}>
        <EditorialLine parts={model.editorial} onPart={handleEditorial} />
      </div>

      <div
        className="cw-home-numbers cw-home-stagger"
        data-testid="home-quiet-numbers"
        style={{ ["--i" as string]: 2 }}
      >
        {model.quietStats.map((stat) => (
          <button
            className="cw-home-num"
            key={stat.id}
            onClick={() => {
              if (stat.action === "overdue") setItemTab("overdue");
              else if (stat.action === "today") setItemTab("today");
              else if (stat.action === "week") setItemTab("week");
              else if (stat.action === "projects") setFocusSection("projects");
              else if (stat.action === "approvals") onOpenApprovals();
            }}
            type="button"
          >
            <QuietStatValue tone={stat.tone} value={stat.value} />
            <span>{stat.label}</span>
          </button>
        ))}
      </div>

      {showActions &&
        (model.actions.length === 0 ? (
          <div
            className="cw-home-action-collapsed cw-home-stagger"
            data-testid="home-action-queue"
            style={{ ["--i" as string]: 3 }}
          >
            <span className="cw-home-action-ok" aria-hidden>
              ✓
            </span>
            <span>
              {locale === "es" ? "Nada te espera." : "Nothing waiting on you."}{" "}
              <em>
                {model.actionCounts.approvals}{" "}
                {locale === "es" ? "aprobaciones" : "approvals"} ·{" "}
                {model.actionCounts.requests} requests · {model.actionCounts.mentions}{" "}
                {locale === "es" ? "menciones" : "mentions"}
              </em>
            </span>
          </div>
        ) : (
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
        ))}

      <MiSemanaCard session={weeklyPlanSession} onReviewFriday={onReviewFriday} />

      <div className="cw-home-split cw-home-stagger" style={{ ["--i" as string]: 4 }}>
        <section className="cw-home-card" data-testid="home-my-items">
          <div className="cw-home-card-head cw-home-tabs">
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
            <span className="cw-home-card-label">
              {locale === "es" ? "Mis ítems" : "My items"}
            </span>
          </div>
          {items.length === 0 ? (
            <p className="cw-home-empty-line">{emptyItemsLabel}</p>
          ) : (
            <>
              <ul className="cw-home-item-list">
                {items.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <button onClick={() => onOpenItem(item.id)} type="button">
                      <TypeGlyph type={item.workItemType} />
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
                  <span>
                    + {items.length - 5} {locale === "es" ? "más" : "more"}
                  </span>
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
                {day.items.slice(0, 3).map((item) => (
                  <button
                    className="cw-home-week-chip"
                    key={item.id}
                    onClick={() => onOpenItem(item.id)}
                    type="button"
                  >
                    <TypeGlyph type={item.workItemType} />
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

      <section
        className="cw-home-card cw-home-stagger"
        data-testid="home-activity"
        style={{ ["--i" as string]: 6 }}
      >
        <div className="cw-home-card-head">
          <h2>{locale === "es" ? "Actividad" : "Activity"}</h2>
        </div>
        {model.activity.length === 0 ? (
          <p className="cw-home-empty-line">
            {locale === "es" ? "Sin actividad reciente" : "No recent activity"}
          </p>
        ) : (
          <ul className="cw-home-activity-list">
            {model.activity.map((row) => (
              <li key={row.id}>
                <span className="cw-home-activity-avatar">{row.avatar || "·"}</span>
                <span className="cw-home-activity-body">
                  {row.verb ? <strong>{row.verb}</strong> : null}
                  {row.verb ? " " : null}
                  {row.itemId && row.object ? (
                    <button
                      className="cw-home-activity-chip"
                      onClick={() => onOpenItem(row.itemId!)}
                      type="button"
                    >
                      {row.object}
                    </button>
                  ) : (
                    <span>{row.text}</span>
                  )}
                </span>
                <em>{row.when}</em>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

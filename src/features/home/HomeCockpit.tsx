import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  Mail,
  RefreshCw,
  Sparkles,
} from "../../components/ui/Icon";
import { getLocale, t } from "../../lib/i18n";
import type { MyWorkActor } from "../../lib/myWorkItems";
import type { WorkspaceMember } from "../../lib/workspaceCollaboration";
import { buildHomeCockpitData, type HomeActionRow, type HomeItemRow } from "./buildHomeCockpitData";
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
  onOpenOdysseus: () => void;
  onNew: () => void;
  onOpenItem: (itemId: string) => void;
  onOpenProject: (projectId: string) => void;
  onApprove: (item: any) => void;
  onRespondRequest: (request: any) => void;
  onOpenApprovals: () => void;
};

function TypeGlyph({ type }: { type: string }) {
  const lower = type.toLowerCase();
  if (lower.includes("bug")) return <AlertTriangle size={14} />;
  return <CheckSquare size={14} />;
}

function dueChip(dueIso: string | null, todayIso: string, locale: string) {
  if (!dueIso) return null;
  const overdueOrToday = dueIso <= todayIso;
  const label =
    dueIso === todayIso
      ? locale === "es"
        ? "hoy"
        : "today"
      : dueIso.slice(5).replace("-", " ");
  return (
    <span className={`cw-home-due ${overdueOrToday ? "is-urgent" : ""}`}>{label}</span>
  );
}

function ActionIcon({ kind }: { kind: HomeActionRow["kind"] }) {
  if (kind === "approval") return <RefreshCw size={14} />;
  if (kind === "request") return <Mail size={14} />;
  return <AlertTriangle size={14} />;
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
  onOpenOdysseus,
  onNew,
  onOpenItem,
  onOpenProject,
  onApprove,
  onRespondRequest,
  onOpenApprovals,
}: HomeCockpitProps) {
  const locale = getLocale();
  const [itemTab, setItemTab] = useState<"today" | "overdue" | "week">("today");
  const [focusSection, setFocusSection] = useState<string | null>(null);

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
      locale,
    ],
  );

  const todayIso = new Date().toISOString().slice(0, 10);
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
      focusSection === "due");

  return (
    <div className="cw-home" data-testid="home-cockpit">
      <header className="cw-home-header">
        <div>
          <h1>{model.greeting}</h1>
          <p className="cw-home-date">{model.longDate}</p>
        </div>
        <div className="cw-home-header-actions">
          <button
            className="cw-home-btn-secondary"
            data-testid="home-open-odysseus"
            onClick={onOpenOdysseus}
            type="button"
          >
            <Sparkles size={14} />
            <span>Odysseus</span>
            <kbd>⌘J</kbd>
          </button>
          <button className="cw-home-btn-primary" onClick={onNew} type="button">
            + {locale === "es" ? "Nuevo" : t("headerCreate")}
          </button>
        </div>
      </header>

      <div className="cw-home-dayline" data-testid="home-day-line">
        <Sparkles size={13} />
        <span className="cw-home-dayline-prefix">
          {locale === "es" ? "Hoy:" : "Today:"}
        </span>
        {model.dayChips.map((chip) => (
          <button
            className={`cw-home-chip is-${chip.tone}`}
            key={chip.id}
            onClick={() => {
              setFocusSection(chip.id);
              if (chip.id === "due") setItemTab(model.overdueItems.length ? "overdue" : "today");
              if (chip.id === "approvals") onOpenApprovals();
            }}
            type="button"
          >
            {chip.count}{" "}
            {chip.id === "due"
              ? locale === "es"
                ? "vencen"
                : "due"
              : chip.id === "blocked"
                ? locale === "es"
                  ? "bloqueado"
                  : "blocked"
                : locale === "es"
                  ? "aprobaciones"
                  : "approvals"}
          </button>
        ))}
        {model.dayLineTail ? (
          <span className="cw-home-dayline-tail">· {model.dayLineTail}</span>
        ) : (
          <span className="cw-home-dayline-tail">{model.dayLine.replace(/^Hoy:\s*|^Today:\s*/i, "")}</span>
        )}
      </div>

      {showActions && (
        <section className="cw-home-card" data-testid="home-action-queue">
          <div className="cw-home-card-head">
            <h2>{locale === "es" ? "Requiere tu acción" : "Needs your action"}</h2>
            <button onClick={onOpenApprovals} type="button">
              {model.actions.length} · {locale === "es" ? "Ver todo" : "See all"}
            </button>
          </div>
          {model.actions.length === 0 ? (
            <p className="cw-home-empty">
              {locale === "es" ? "Nada pendiente de tu acción." : "Nothing waiting on you."}
            </p>
          ) : (
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
                      else if (row.kind === "blocked" && row.payload && (row.payload as HomeItemRow).id) {
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
                        : locale === "es"
                          ? "Abrir"
                          : "Open"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="cw-home-split">
        <section className="cw-home-card" data-testid="home-my-items">
          <div className="cw-home-card-head cw-home-tabs">
            <div className="cw-home-tab-row">
              {(
                [
                  ["today", locale === "es" ? "Hoy" : "Today", model.todayItems.length],
                  ["overdue", locale === "es" ? "Vencidos" : "Overdue", model.overdueItems.length],
                  ["week", locale === "es" ? "Semana" : "Week", model.weekItems.length],
                ] as const
              ).map(([id, label, count]) => (
                <button
                  className={itemTab === id ? "is-active" : ""}
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
            <p className="cw-home-empty">{t("emptyMyWork")}</p>
          ) : (
            <ul className="cw-home-item-list">
              {items.slice(0, 8).map((item) => (
                <li key={item.id}>
                  <button onClick={() => onOpenItem(item.id)} type="button">
                    <TypeGlyph type={item.workItemType} />
                    <span className="cw-home-item-main">
                      <strong>{item.title}</strong>
                      <em>
                        {[item.projectTitle, item.status].filter(Boolean).join(" · ")}
                      </em>
                    </span>
                    {dueChip(item.dueIso, todayIso, locale)}
                    <ChevronRight size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="cw-home-card" data-testid="home-my-projects">
          <div className="cw-home-card-head">
            <h2>{locale === "es" ? "Mis proyectos" : "My projects"}</h2>
            <span>{model.projects.length}</span>
          </div>
          {model.projects.length === 0 ? (
            <p className="cw-home-empty">{t("emptyWork")}</p>
          ) : (
            <ul className="cw-home-project-list">
              {model.projects.map((project) => (
                <li key={project.id}>
                  <button onClick={() => onOpenProject(project.id)} type="button">
                    <span className={`cw-home-health is-${project.health}`} />
                    <span className="cw-home-project-main">
                      <strong>{project.title}</strong>
                      <span className="cw-home-bar-wrap">
                        <span className="cw-home-bar" style={{ width: `${project.pct}%` }} />
                      </span>
                      <em>
                        {project.pct}% · {project.line}
                      </em>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="cw-home-card" data-testid="home-next-7">
        <div className="cw-home-card-head">
          <h2>{locale === "es" ? "Próximos 7 días" : "Next 7 days"}</h2>
        </div>
        <div className="cw-home-week-strip">
          {model.next7Days.map((day) => (
            <div className={`cw-home-week-day ${day.isToday ? "is-today" : ""}`} key={day.iso}>
              <span className="cw-home-week-label">{day.label}</span>
              <div className="cw-home-week-chips">
                {day.items.slice(0, 3).map((item) => (
                  <button key={item.id} onClick={() => onOpenItem(item.id)} type="button">
                    {item.title}
                  </button>
                ))}
                {!day.items.length && <span className="cw-home-week-empty">—</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="cw-home-card" data-testid="home-activity">
        <div className="cw-home-card-head">
          <h2>{locale === "es" ? "Actividad" : "Activity"}</h2>
        </div>
        {model.activity.length === 0 ? (
          <p className="cw-home-empty">
            {locale === "es" ? "Sin actividad reciente." : "No recent activity."}
          </p>
        ) : (
          <ul className="cw-home-activity-list">
            {model.activity.map((row) => (
              <li key={row.id}>
                <span className="cw-home-activity-avatar">{row.avatar || "·"}</span>
                <span>{row.text}</span>
                <em>{row.when}</em>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

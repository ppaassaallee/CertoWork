import { useEffect, useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { Gauge, Sparkles } from "../../components/ui/Icon";
import { db } from "../../lib/firebase";
import { t, type MessageKey } from "../../lib/i18n";
import {
  DIRECTION_WIDGET_ORDER,
  defaultDirectionLayout,
  loadDirectionLayout,
  normalizeDirectionLayout,
  saveDirectionLayout,
  visibleDirectionWidgets,
  type DirectionLayout,
  type DirectionWidgetId,
} from "../../lib/directionLayout";
import {
  buildDirectionData,
  formatDirectionMoney,
  type DirectionData,
} from "./buildDirectionData";
import { WorkloadWidget } from "./widgets/WorkloadWidget";
import { OverdueByOwnerWidget } from "./widgets/OverdueByOwnerWidget";
import { ProjectsAttentionWidget } from "./widgets/ProjectsAttentionWidget";
import { MoneyWidget } from "./widgets/MoneyWidget";
import { ControlsWidget } from "./widgets/ControlsWidget";
import { RequestsWidget } from "./widgets/RequestsWidget";

const WIDGET_LABEL_KEY: Record<DirectionWidgetId, MessageKey> = {
  workload: "direction.widget.workload",
  overdue: "direction.widget.overdue",
  projects: "direction.widget.projects",
  money: "direction.widget.money",
  controls: "direction.widget.controls",
  requests: "direction.widget.requests",
};

export function DirectionPage({
  userId,
  locale = "en",
  tasks,
  projects,
  members,
  invoices,
  requests,
  supportCases = [],
  tables,
  records,
  risks = [],
  onOpenWorkload,
  onOpenMyWork,
  onOpenProjects,
  onOpenCosts,
  onOpenInvoices,
  onOpenTables,
  onOpenTable,
  onOpenRequests,
  onOpenProject,
  onOpenPerson,
  onOpenItem,
}: {
  userId: string;
  locale?: string;
  tasks: any[];
  projects: any[];
  members: any[];
  invoices: any[];
  requests: any[];
  supportCases?: any[];
  tables: any[];
  records: any[];
  risks?: any[];
  onOpenWorkload(): void;
  onOpenMyWork(): void;
  onOpenProjects(): void;
  onOpenCosts(): void;
  onOpenInvoices(): void;
  onOpenTables(): void;
  onOpenTable(tableId: string): void;
  onOpenRequests(): void;
  onOpenProject(projectId: string): void;
  onOpenPerson(userId: string | null): void;
  onOpenItem(id: string): void;
}) {
  const [layout, setLayout] = useState<DirectionLayout>(() =>
    userId ? loadDirectionLayout(userId) : defaultDirectionLayout(),
  );
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [dragId, setDragId] = useState<DirectionWidgetId | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLayout(loadDirectionLayout(userId));
  }, [userId]);

  const persist = (next: DirectionLayout) => {
    const normalized = normalizeDirectionLayout(next);
    setLayout(normalized);
    if (!userId) return;
    saveDirectionLayout(userId, normalized);
    void setDoc(
      doc(db, "users", userId),
      { directionLayout: normalized },
      { merge: true },
    ).catch(() => {
      /* localStorage is enough if users doc is locked */
    });
  };

  const data: DirectionData = useMemo(
    () =>
      buildDirectionData({
        tasks,
        projects,
        members,
        invoices,
        requests,
        supportCases,
        tables,
        records,
        risks,
        locale,
        unassignedLabel: t("direction.unassigned"),
      }),
    [tasks, projects, members, invoices, requests, supportCases, tables, records, risks, locale],
  );

  const visible = visibleDirectionWidgets(layout);
  const monthPct =
    data.money.planned > 0
      ? Math.round((data.money.invoiced / data.money.planned) * 100)
      : 0;
  const moneyFooter = [
    `${monthPct}%`,
    data.money.costs > 0
      ? `${t("direction.money.costs")} ${formatDirectionMoney(data.money.costs)}`
      : null,
    data.money.marginPct != null
      ? `${t("direction.money.margin")} ${data.money.marginPct}%`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const renderWidget = (id: DirectionWidgetId) => {
    if (id === "workload") {
      return (
        <WorkloadWidget
          emptyLabel={t("direction.empty.workload")}
          key={id}
          linkLabel={t("direction.link.workload")}
          onOpen={onOpenWorkload}
          onOpenPerson={(personId) => onOpenPerson(personId)}
          rows={data.workload}
          title={t("direction.widget.workload")}
        />
      );
    }
    if (id === "overdue") {
      const total = data.overdueByOwner.reduce((sum, row) => sum + row.count, 0);
      return (
        <OverdueByOwnerWidget
          emptyLabel={t("direction.empty.overdue")}
          key={id}
          linkLabel={t("direction.link.overdue")}
          onOpen={onOpenMyWork}
          onOpenOwner={onOpenPerson}
          rows={data.overdueByOwner}
          title={t("direction.widget.overdue")}
          totalLabel={`${total} · ${t("direction.link.overdue")}`}
        />
      );
    }
    if (id === "projects") {
      const openCount = data.projectsAttention.length + data.onTrackCount;
      return (
        <ProjectsAttentionWidget
          emptyLabel={t("direction.empty.projects")}
          footerLabel={t("direction.projects.footer")
            .replace("{onTrack}", String(data.onTrackCount))
            .replace("{excluded}", t("direction.projects.excluded"))}
          key={id}
          linkLabel={t("direction.projects.count")
            .replace("{n}", String(data.projectsAttention.length))
            .replace("{total}", String(openCount))}
          onOpen={onOpenProjects}
          onOpenProject={onOpenProject}
          rows={data.projectsAttention}
          title={t("direction.widget.projects")}
        />
      );
    }
    if (id === "money") {
      return (
        <MoneyWidget
          emptyLabel={t("direction.empty.money")}
          key={id}
          labels={{
            invoiced: t("direction.money.invoiced"),
            planned: t("direction.money.planned"),
            overdue: t("direction.money.overdueInvoices"),
            footer: moneyFooter,
          }}
          linkLabel={t("direction.link.money")}
          money={data.money}
          onOpen={() =>
            data.money.overdueInvoices > 0 ? onOpenInvoices() : onOpenCosts()
          }
          title={`${t("direction.widget.money")} · ${data.money.monthLabel}`}
        />
      );
    }
    if (id === "controls") {
      return (
        <ControlsWidget
          emptyLabel={t("direction.empty.controls")}
          formatMeta={(row) => {
            if (row.overdue > 0 && row.dueSoon > 0) {
              return t("direction.controls.metaBoth")
                .replace("{overdue}", String(row.overdue))
                .replace("{soon}", String(row.dueSoon));
            }
            if (row.overdue > 0) {
              return t("direction.controls.metaOverdue").replace(
                "{n}",
                String(row.overdue),
              );
            }
            return t("direction.controls.metaSoon").replace("{n}", String(row.dueSoon));
          }}
          key={id}
          linkLabel={t("direction.link.controls")}
          onOpen={onOpenTables}
          onOpenTable={onOpenTable}
          rows={data.controls}
          title={t("direction.widget.controls")}
        />
      );
    }
    return (
      <RequestsWidget
        data={data.requests}
        emptyLabel={t("direction.empty.requests")}
        key={id}
        labels={{
          unanswered: t("direction.requests.unanswered"),
          older: t("direction.requests.older"),
          tickets: t("direction.requests.tickets"),
          critical: t("direction.requests.critical"),
        }}
        linkLabel={t("direction.link.requests")}
        onOpen={onOpenRequests}
        onOpenItem={onOpenItem}
        title={t("direction.widget.requests")}
      />
    );
  };

  const moveWidget = (from: DirectionWidgetId, to: DirectionWidgetId) => {
    if (from === to) return;
    const order = [...layout.order];
    const fromIndex = order.indexOf(from);
    const toIndex = order.indexOf(to);
    if (fromIndex < 0 || toIndex < 0) return;
    order.splice(fromIndex, 1);
    order.splice(toIndex, 0, from);
    persist({ ...layout, order });
  };

  return (
    <div className="cw-dir" data-testid="direction-page">
      <header className="cw-dir-head">
        <div>
          <div className="cw-dir-week">
            {t("direction.week")
              .replace("{n}", String(data.week.number))
              .replace("{range}", data.week.rangeLabel)}
          </div>
          <h1>
            <Gauge size={18} aria-hidden />
            {t("nav.direction")}
          </h1>
        </div>
        <div className="cw-dir-customize-wrap">
          <button
            className="cw-dir-customize"
            data-testid="direction-customize"
            onClick={() => setCustomizeOpen((open) => !open)}
            type="button"
          >
            {t("direction.customize")}
          </button>
          {customizeOpen ? (
            <div className="cw-dir-customize-pop" data-testid="direction-customize-pop">
              <p className="cw-dir-customize-hint">{t("direction.customize.hint")}</p>
              {layout.order.map((id) => {
                const hidden = layout.hidden.includes(id);
                return (
                  <div
                    className={`cw-dir-customize-row${dragId === id ? " is-dragging" : ""}`}
                    draggable
                    key={id}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (dragId) moveWidget(dragId, id);
                    }}
                    onDragStart={() => setDragId(id)}
                    onDragEnd={() => setDragId(null)}
                  >
                    <span className="cw-dir-drag">⋮⋮</span>
                    <span className="cw-dir-row-title">{t(WIDGET_LABEL_KEY[id])}</span>
                    <button
                      aria-pressed={!hidden}
                      className={`cw-dir-toggle${hidden ? "" : " is-on"}`}
                      onClick={() => {
                        const nextHidden = hidden
                          ? layout.hidden.filter((row) => row !== id)
                          : [...layout.hidden, id];
                        // Keep at least one widget visible.
                        if (nextHidden.length >= DIRECTION_WIDGET_ORDER.length) return;
                        persist({ ...layout, hidden: nextHidden });
                      }}
                      type="button"
                    >
                      {hidden ? t("direction.hide") : t("direction.show")}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </header>

      <p className="cw-dir-summary" data-testid="direction-summary">
        <Sparkles size={12} aria-hidden />
        <span>{data.summaryFallback.slice(0, 160)}</span>
      </p>

      <div className="cw-dir-grid">{visible.map((id) => renderWidget(id))}</div>
    </div>
  );
}

import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Filter,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Search,
  UserPlus,
  X,
} from "./ui/Icon";
import {
  CHARGE_LINE_TYPE_COLORS,
  CHARGE_LINE_TYPES,
  financeMonthLabel,
} from "../lib/financeChargeTypes";
import {
  FINANCE_BILLING_STATUSES,
  FINANCE_BILLING_STATUS_COLORS,
  FINANCE_LINE_TASK_SOURCE,
  FINANCE_VENDOR_PAY_STATUSES,
  FINANCE_VENDOR_PAY_STATUS_COLORS,
  financeBillingStatusLabels,
  financeBillingStatusPatch,
  financeLineIdFromTask,
  financeVendorPayStatusLabels,
  isFinanceLineTask,
  normalizeFinanceBillingStatus,
  normalizeFinanceVendorPayStatus,
  type FinanceVendorPayStatus,
} from "../lib/financeBillingStatuses";
import {
  financeLineFollowUpDescription,
  financeLineFollowUpTitle,
  patchProjectFinanceLine,
} from "../lib/financeLineActions";
import {
  PORTFOLIO_FINANCE_COLUMNS,
  PORTFOLIO_FINANCE_FILTERABLE_COLUMNS,
  buildPortfolioFinanceRows,
  defaultPortfolioFinanceColumns,
  ensureProjectFinanceColumn,
  filterPortfolioFinanceRows,
  groupPortfolioFinanceByMonthThenProject,
  portfolioFinanceColumnLabels,
  uniquePortfolioFinanceValues,
  type PortfolioFinanceColumn,
  type PortfolioFinanceColumnFilters,
  type PortfolioFinanceRow,
} from "../lib/portfolioFinancialRows";
import { MultiAssigneePicker } from "./ProjectControls";
import type { WorkLane } from "../lib/projectPortfolio";

type AssignmentMember = {
  id: string;
  userId?: string;
  name?: string;
  displayName?: string;
  email?: string;
  status?: string;
};

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="do-items-empty">
      {icon}
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function formatMoney(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatCell(row: PortfolioFinanceRow, column: PortfolioFinanceColumn) {
  switch (column) {
    case "project":
      return row.project;
    case "projectId":
      return row.projectKey;
    case "client":
      return row.client;
    case "product":
      return row.product;
    case "bpo":
      return row.bpo;
    case "externalOrInternal":
      return row.externalOrInternal;
    case "stage":
      return row.stage;
    case "phase":
      return row.phase;
    case "status":
      return row.status;
    case "type":
      return row.type;
    case "month":
      return row.monthLabel;
    case "unit":
      return row.unit;
    case "units":
      return row.units.toLocaleString();
    case "costPerUnit":
      return `$${row.costPerUnit.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    case "cost":
      return `$${row.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    case "marginPct":
      return row.marginPct == null ? "—" : `${(row.marginPct * 100).toFixed(2)}%`;
    case "price":
      return `$${row.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    case "billingStatus":
      return financeBillingStatusLabels[row.billingStatus];
    case "vendorPayStatus":
      return financeVendorPayStatusLabels[row.vendorPayStatus];
    case "vendorInvoice":
      return row.vendorInvoice || "—";
    case "clientInvoice":
      return row.clientInvoice || "—";
    case "source":
      return row.source;
    default:
      return "—";
  }
}

export function PortfolioFinanceAnalyst({
  projects,
  tasks = [],
  workspaceMembers = [],
  highlightFinanceLineId = null,
  onUpdateProject,
  onAddTask,
  onOpenWorkItem,
  onHighlightConsumed,
}: {
  projects: any[];
  tasks?: any[];
  workspaceMembers?: AssignmentMember[];
  highlightFinanceLineId?: string | null;
  onUpdateProject: (projectId: string, patch: Record<string, unknown>) => Promise<void> | void;
  onAddTask?: (
    projectId: string,
    title: string,
    status: WorkLane,
    patch?: Record<string, unknown>,
  ) => Promise<string | void | undefined>;
  onOpenWorkItem?: (taskId: string) => void;
  onHighlightConsumed?: () => void;
}) {
  const [financeSearch, setFinanceSearch] = useState("");
  const [financeClient, setFinanceClient] = useState("all");
  const [financeBpo, setFinanceBpo] = useState("all");
  const [financeProduct, setFinanceProduct] = useState("all");
  const [financeMonth, setFinanceMonth] = useState("all");
  const [financeType, setFinanceType] = useState("all");
  const [financeBilled, setFinanceBilled] = useState<"all" | "billed" | "unbilled">("all");
  const [financeColumnFilters, setFinanceColumnFilters] =
    useState<PortfolioFinanceColumnFilters>({});
  const [financeFilterMenu, setFinanceFilterMenu] = useState<PortfolioFinanceColumn | null>(
    null,
  );
  const [financeFilterQuery, setFinanceFilterQuery] = useState("");
  const [financeColumns, setFinanceColumns] = useState<PortfolioFinanceColumn[]>(() => {
    if (typeof window === "undefined") {
      return ensureProjectFinanceColumn(defaultPortfolioFinanceColumns);
    }
    try {
      const stored = JSON.parse(
        window.localStorage.getItem("certo-portfolio-finance-columns-v2") ||
          window.localStorage.getItem("certo-portfolio-finance-columns") ||
          "null",
      );
      return ensureProjectFinanceColumn(
        Array.isArray(stored) && stored.length
          ? stored
          : defaultPortfolioFinanceColumns,
      );
    } catch {
      return ensureProjectFinanceColumn(defaultPortfolioFinanceColumns);
    }
  });
  const [followUpRow, setFollowUpRow] = useState<PortfolioFinanceRow | null>(null);
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [followUpAssigneeIds, setFollowUpAssigneeIds] = useState<string[]>([]);
  const [followUpAssigneeNames, setFollowUpAssigneeNames] = useState<string[]>([]);
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [activeLineId, setActiveLineId] = useState<string | null>(highlightFinanceLineId);

  useEffect(() => {
    if (!highlightFinanceLineId) return;
    setActiveLineId(highlightFinanceLineId);
    const timer = window.setTimeout(() => {
      const node = document.querySelector(
        `[data-finance-line-id="${CSS.escape(highlightFinanceLineId)}"]`,
      );
      node?.scrollIntoView({ block: "center", behavior: "smooth" });
      onHighlightConsumed?.();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [highlightFinanceLineId, onHighlightConsumed]);

  const portfolioFinanceAllRows = useMemo(
    () => buildPortfolioFinanceRows(projects),
    [projects],
  );
  const portfolioFinanceFilteredRows = useMemo(
    () =>
      filterPortfolioFinanceRows(portfolioFinanceAllRows, {
        search: financeSearch,
        client: financeClient,
        bpo: financeBpo,
        product: financeProduct,
        month: financeMonth,
        type: financeType,
        billed: financeBilled,
        columnFilters: financeColumnFilters,
      }),
    [
      portfolioFinanceAllRows,
      financeSearch,
      financeClient,
      financeBpo,
      financeProduct,
      financeMonth,
      financeType,
      financeBilled,
      financeColumnFilters,
    ],
  );
  const portfolioFinanceBreaks = useMemo(
    () => groupPortfolioFinanceByMonthThenProject(portfolioFinanceFilteredRows),
    [portfolioFinanceFilteredRows],
  );
  const financeClientOptions = useMemo(
    () =>
      [...new Set(portfolioFinanceAllRows.map((row) => row.client))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [portfolioFinanceAllRows],
  );
  const financeBpoOptions = useMemo(
    () =>
      [...new Set(portfolioFinanceAllRows.map((row) => row.bpo))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [portfolioFinanceAllRows],
  );
  const financeProductOptions = useMemo(
    () =>
      [...new Set(portfolioFinanceAllRows.map((row) => row.product))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [portfolioFinanceAllRows],
  );
  const financeMonthOptions = useMemo(
    () =>
      [...new Set(portfolioFinanceAllRows.map((row) => row.monthKey))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [portfolioFinanceAllRows],
  );
  const financeVisibleColumns = ensureProjectFinanceColumn(financeColumns);
  const financeColumnSet = new Set(financeVisibleColumns);
  const portfolioFinanceTotals = useMemo(
    () => ({
      cost: portfolioFinanceFilteredRows.reduce((sum, row) => sum + row.cost, 0),
      price: portfolioFinanceFilteredRows.reduce((sum, row) => sum + row.price, 0),
      lines: portfolioFinanceFilteredRows.length,
      billed: portfolioFinanceFilteredRows.filter((row) => row.billed).length,
    }),
    [portfolioFinanceFilteredRows],
  );

  const tasksByFinanceLine = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const task of tasks) {
      if (!isFinanceLineTask(task)) continue;
      const lineId = financeLineIdFromTask(task);
      if (!lineId) continue;
      const list = map.get(lineId) || [];
      list.push(task);
      map.set(lineId, list);
    }
    return map;
  }, [tasks]);

  const financeFilterOptions = useMemo(() => {
    if (!financeFilterMenu) return [];
    const withoutColumn = filterPortfolioFinanceRows(portfolioFinanceAllRows, {
      search: financeSearch,
      client: financeClient,
      bpo: financeBpo,
      product: financeProduct,
      month: financeMonth,
      type: financeType,
      billed: financeBilled,
      columnFilters: { ...financeColumnFilters, [financeFilterMenu]: undefined },
    });
    return uniquePortfolioFinanceValues(withoutColumn, financeFilterMenu);
  }, [
    financeFilterMenu,
    portfolioFinanceAllRows,
    financeSearch,
    financeClient,
    financeBpo,
    financeProduct,
    financeMonth,
    financeType,
    financeBilled,
    financeColumnFilters,
  ]);
  const activeFinanceColumnFilter = financeFilterMenu
    ? financeColumnFilters[financeFilterMenu]
    : undefined;

  const persistColumns = (next: PortfolioFinanceColumn[]) => {
    const safe = ensureProjectFinanceColumn(next);
    window.localStorage.setItem(
      "certo-portfolio-finance-columns-v2",
      JSON.stringify(safe),
    );
    setFinanceColumns(safe);
  };

  const toggleFinanceColumn = (column: PortfolioFinanceColumn) => {
    if (column === "project" || column === "followUp") return;
    const next = financeVisibleColumns.includes(column)
      ? financeVisibleColumns.filter((item) => item !== column)
      : [...financeVisibleColumns, column];
    persistColumns(next.length ? next : defaultPortfolioFinanceColumns);
  };

  const toggleFinanceColumnFilterValue = (
    column: PortfolioFinanceColumn,
    value: string,
  ) => {
    setFinanceColumnFilters((current) => {
      const options = uniquePortfolioFinanceValues(
        filterPortfolioFinanceRows(portfolioFinanceAllRows, {
          search: financeSearch,
          client: financeClient,
          bpo: financeBpo,
          product: financeProduct,
          month: financeMonth,
          type: financeType,
          billed: financeBilled,
          columnFilters: { ...current, [column]: undefined },
        }),
        column,
      );
      const selected = current[column];
      const baseline = selected && selected.length ? selected : options;
      const nextSelected = baseline.includes(value)
        ? baseline.filter((item) => item !== value)
        : [...baseline, value];
      const next = { ...current };
      if (nextSelected.length === 0 || nextSelected.length === options.length) {
        delete next[column];
      } else {
        next[column] = nextSelected;
      }
      return next;
    });
  };

  const patchFinanceLine = async (
    row: PortfolioFinanceRow,
    patch: Record<string, unknown>,
  ) => {
    const project = projects.find((item) => item.id === row.projectId);
    if (!project) return;
    const next = patchProjectFinanceLine(project, row.id, patch);
    if (!next) return;
    await onUpdateProject(row.projectId, { financePeriods: next });
  };

  const openFollowUp = (row: PortfolioFinanceRow) => {
    setFollowUpRow(row);
    setFollowUpTitle(financeLineFollowUpTitle(row));
    setFollowUpNotes("");
    setFollowUpAssigneeIds([]);
    setFollowUpAssigneeNames([]);
  };

  const submitFollowUp = async () => {
    if (!followUpRow || !onAddTask || !followUpTitle.trim()) return;
    setFollowUpBusy(true);
    try {
      const description = [
        financeLineFollowUpDescription(followUpRow),
        followUpNotes.trim() ? `\nNotes:\n${followUpNotes.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const taskId = await onAddTask(followUpRow.projectId, followUpTitle.trim(), "backlog", {
        workItemType: "pbi",
        type: "pbi",
        itemType: "pbi",
        source: FINANCE_LINE_TASK_SOURCE,
        sourceFinanceLineId: followUpRow.id,
        financeLineId: followUpRow.id,
        description,
        ...(followUpAssigneeIds.length
          ? {
              assigneeIds: followUpAssigneeIds,
              assignees: followUpAssigneeNames,
              owner: followUpAssigneeNames[0] || "",
              assignee: followUpAssigneeNames[0] || "",
            }
          : {}),
      });
      setFollowUpRow(null);
      if (taskId && onOpenWorkItem) onOpenWorkItem(String(taskId));
    } finally {
      setFollowUpBusy(false);
    }
  };

  const renderBreakCells = (
    label: string,
    cost: number,
    price: number,
    kind: "month" | "project",
  ) => (
    <>
      {financeVisibleColumns.map((column, index) => {
        const className = [
          column === "project" ? "is-frozen" : "",
          column === "followUp" ? "is-follow-up is-follow-up-sticky" : "",
          column === "cost" || column === "price" ? "is-numeric" : "",
        ]
          .filter(Boolean)
          .join(" ");
        if (index === 0) {
          return (
            <td className={className} key={`${kind}-${column}-label`}>
              <strong>{label}</strong>
            </td>
          );
        }
        if (column === "cost") {
          return (
            <td className={className} key={`${kind}-${column}`}>
              {formatMoney(cost)}
            </td>
          );
        }
        if (column === "price") {
          return (
            <td className={className} key={`${kind}-${column}`}>
              {formatMoney(price)}
            </td>
          );
        }
        return <td className={className} key={`${kind}-${column}`} />;
      })}
    </>
  );

  const renderEditableCell = (row: PortfolioFinanceRow, column: PortfolioFinanceColumn) => {
    const isFrozen = column === "project";
    const className = [
      isFrozen ? "is-frozen" : "",
      ["cost", "price", "units", "costPerUnit", "marginPct"].includes(column)
        ? "is-numeric"
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (column === "type") {
      const typeColors = CHARGE_LINE_TYPE_COLORS[row.type];
      return (
        <td className={className} key={`${row.id}-${column}`}>
          <span
            className="do-finance-charge-type"
            style={{
              background: typeColors.bg,
              borderColor: typeColors.border,
              color: typeColors.fg,
            }}
            title={row.type}
          >
            {row.type}
          </span>
        </td>
      );
    }

    if (column === "billingStatus") {
      const colors = FINANCE_BILLING_STATUS_COLORS[row.billingStatus];
      return (
        <td className={className} key={`${row.id}-${column}`}>
          <select
            aria-label="Billing status"
            className="do-finance-status-select"
            onChange={(event) => {
              const financialStatus = normalizeFinanceBillingStatus(event.target.value);
              void patchFinanceLine(row, financeBillingStatusPatch(financialStatus));
            }}
            style={{
              background: colors.bg,
              borderColor: colors.border,
              color: colors.fg,
            }}
            value={row.billingStatus}
          >
            {FINANCE_BILLING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {financeBillingStatusLabels[status]}
              </option>
            ))}
          </select>
        </td>
      );
    }

    if (column === "vendorPayStatus") {
      const colors = FINANCE_VENDOR_PAY_STATUS_COLORS[row.vendorPayStatus];
      return (
        <td className={className} key={`${row.id}-${column}`}>
          <select
            aria-label="Vendor pay status"
            className="do-finance-status-select"
            onChange={(event) => {
              const paymentStatus = normalizeFinanceVendorPayStatus(
                event.target.value,
              ) as FinanceVendorPayStatus;
              void patchFinanceLine(row, { paymentStatus });
            }}
            style={{
              background: colors.bg,
              borderColor: colors.border,
              color: colors.fg,
            }}
            value={row.vendorPayStatus}
          >
            {FINANCE_VENDOR_PAY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {financeVendorPayStatusLabels[status]}
              </option>
            ))}
          </select>
        </td>
      );
    }

    if (column === "vendorInvoice" || column === "clientInvoice") {
      return (
        <td className={className} key={`${row.id}-${column}`}>
          <input
            aria-label={portfolioFinanceColumnLabels[column]}
            className="do-finance-inline-input"
            defaultValue={
              column === "vendorInvoice" ? row.vendorInvoice : row.clientInvoice
            }
            key={`${row.id}-${column}-${column === "vendorInvoice" ? row.vendorInvoice : row.clientInvoice}`}
            onBlur={(event) => {
              const value = event.target.value.trim();
              const current =
                column === "vendorInvoice" ? row.vendorInvoice : row.clientInvoice;
              if (value === current) return;
              void patchFinanceLine(
                row,
                column === "vendorInvoice"
                  ? { vendorInvoice: value, referenceNumber: value || row.source }
                  : { clientInvoice: value },
              );
            }}
            placeholder="—"
          />
        </td>
      );
    }

    if (column === "followUp") {
      const linked = tasksByFinanceLine.get(row.id) || [];
      return (
        <td
          className={`${className} is-follow-up is-follow-up-sticky`}
          key={`${row.id}-${column}`}
        >
          <div className="do-portfolio-finance-followups">
            <button
              aria-label={`Assign PBI follow-up for ${row.project}`}
              className="do-portfolio-finance-followup-btn is-labeled"
              data-testid="finance-assign-pbi"
              onClick={() => openFollowUp(row)}
              title="Create a PBI in My Work and assign a teammate"
              type="button"
            >
              <UserPlus size={13} />
              <span>Assign PBI</span>
            </button>
            {linked.slice(0, 2).map((task) => (
              <button
                className="do-portfolio-finance-task-chip"
                data-testid="finance-open-linked-task"
                key={task.id}
                onClick={() => onOpenWorkItem?.(task.id)}
                title={`Open ${String(task.title || "task")} and comments`}
                type="button"
              >
                <MessageSquare size={11} />
                <span>{String(task.key || task.title || "Task").slice(0, 18)}</span>
              </button>
            ))}
            {linked.length > 2 && (
              <span className="do-portfolio-finance-task-more">+{linked.length - 2}</span>
            )}
          </div>
        </td>
      );
    }

    const text = formatCell(row, column);
    return (
      <td className={className} key={`${row.id}-${column}`} title={String(text)}>
        {text}
      </td>
    );
  };

  return (
    <div className="do-portfolio-finance-analyst" data-testid="portfolio-finance-analyst">
      <header className="do-portfolio-finance-analyst-head">
        <div>
          <span className="do-project-card-kicker">TRANSACTIONS BY PROJECT</span>
          <strong>Portfolio financials</strong>
          <small>
            Scroll horizontally for billing fields · <strong>Assign PBI</strong> stays
            pinned on the right · linked tasks open My Work comments ·{" "}
            {portfolioFinanceTotals.lines.toLocaleString()} lines
          </small>
        </div>
        <div className="do-portfolio-finance-analyst-totals">
          <span>Cost</span>
          <strong>{formatMoney(portfolioFinanceTotals.cost)}</strong>
          <span>Price</span>
          <strong>{formatMoney(portfolioFinanceTotals.price)}</strong>
        </div>
      </header>

      <div className="do-portfolio-finance-filters">
        <label>
          <Search size={13} />
          <input
            aria-label="Search financial lines"
            onChange={(event) => setFinanceSearch(event.target.value)}
            placeholder="Search project, client, product, invoice…"
            value={financeSearch}
          />
        </label>
        <label>
          Client
          <select
            aria-label="Filter by client"
            onChange={(event) => setFinanceClient(event.target.value)}
            value={financeClient}
          >
            <option value="all">All clients</option>
            {financeClientOptions.map((client) => (
              <option key={client} value={client}>
                {client}
              </option>
            ))}
          </select>
        </label>
        <label>
          Period
          <select
            aria-label="Filter by period"
            onChange={(event) => setFinanceMonth(event.target.value)}
            value={financeMonth}
          >
            <option value="all">All periods</option>
            {financeMonthOptions.map((month) => (
              <option key={month} value={month}>
                {financeMonthLabel(month)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Product
          <select
            aria-label="Filter by product"
            onChange={(event) => setFinanceProduct(event.target.value)}
            value={financeProduct}
          >
            <option value="all">All products</option>
            {financeProductOptions.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </select>
        </label>
        <label>
          BPO
          <select
            aria-label="Filter by BPO"
            onChange={(event) => setFinanceBpo(event.target.value)}
            value={financeBpo}
          >
            <option value="all">All BPOs</option>
            {financeBpoOptions.map((bpo) => (
              <option key={bpo} value={bpo}>
                {bpo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select
            aria-label="Filter by charge type"
            onChange={(event) => setFinanceType(event.target.value)}
            value={financeType}
          >
            <option value="all">All types</option>
            {CHARGE_LINE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Billed
          <select
            aria-label="Filter by billed status"
            onChange={(event) =>
              setFinanceBilled(event.target.value as "all" | "billed" | "unbilled")
            }
            value={financeBilled}
          >
            <option value="all">All lines</option>
            <option value="billed">Billed only</option>
            <option value="unbilled">Unbilled only</option>
          </select>
        </label>
      </div>

      <details className="do-portfolio-finance-columns">
        <summary>Columns</summary>
        <div>
          {PORTFOLIO_FINANCE_COLUMNS.map((column) => (
            <label key={column}>
              <input
                checked={financeColumnSet.has(column)}
                disabled={column === "project" || column === "followUp"}
                onChange={() => toggleFinanceColumn(column)}
                type="checkbox"
              />
              {portfolioFinanceColumnLabels[column]}
              {column === "project" ? " (frozen)" : ""}
              {column === "followUp" ? " (actions)" : ""}
            </label>
          ))}
        </div>
      </details>

      <div className="do-portfolio-finance-sheet-scroll">
        <table className="do-portfolio-finance-table" data-testid="portfolio-finance-table">
          <thead>
            <tr>
              {financeVisibleColumns.map((column) => {
                const filterable = PORTFOLIO_FINANCE_FILTERABLE_COLUMNS.includes(column);
                const activeFilter = Boolean(financeColumnFilters[column]?.length);
                return (
                  <th
                    className={[
                      column === "project" ? "is-frozen" : "",
                      ["cost", "price", "units", "costPerUnit", "marginPct"].includes(column)
                        ? "is-numeric"
                        : "",
                      activeFilter ? "is-filtered" : "",
                      column === "followUp" ? "is-follow-up is-follow-up-sticky" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={column}
                    scope="col"
                  >
                    <div className="do-portfolio-finance-th">
                      <span>
                        {column === "followUp"
                          ? "Actions"
                          : portfolioFinanceColumnLabels[column]}
                      </span>
                      {filterable && (
                        <button
                          aria-expanded={financeFilterMenu === column}
                          aria-label={`Filter ${portfolioFinanceColumnLabels[column]}`}
                          className={
                            activeFilter || financeFilterMenu === column ? "is-active" : ""
                          }
                          onClick={() => {
                            setFinanceFilterMenu((current) =>
                              current === column ? null : column,
                            );
                            setFinanceFilterQuery("");
                          }}
                          type="button"
                        >
                          <Filter size={11} />
                        </button>
                      )}
                    </div>
                    {financeFilterMenu === column && (
                      <div
                        className="do-portfolio-finance-filter-menu"
                        data-testid={`portfolio-finance-filter-${column}`}
                      >
                        <input
                          aria-label={`Search ${portfolioFinanceColumnLabels[column]} values`}
                          onChange={(event) => setFinanceFilterQuery(event.target.value)}
                          placeholder="Search values…"
                          value={financeFilterQuery}
                        />
                        <div className="do-portfolio-finance-filter-list">
                          {financeFilterOptions
                            .filter((value) =>
                              value
                                .toLowerCase()
                                .includes(financeFilterQuery.toLowerCase()),
                            )
                            .map((value) => {
                              const checked =
                                !activeFinanceColumnFilter ||
                                activeFinanceColumnFilter.includes(value);
                              return (
                                <label key={value}>
                                  <input
                                    checked={checked}
                                    onChange={() =>
                                      toggleFinanceColumnFilterValue(column, value)
                                    }
                                    type="checkbox"
                                  />
                                  <span title={value}>{value}</span>
                                </label>
                              );
                            })}
                        </div>
                        <div className="do-portfolio-finance-filter-actions">
                          <button
                            onClick={() =>
                              setFinanceColumnFilters((current) => {
                                const next = { ...current };
                                delete next[column];
                                return next;
                              })
                            }
                            type="button"
                          >
                            Clear
                          </button>
                          <button onClick={() => setFinanceFilterMenu(null)} type="button">
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {portfolioFinanceBreaks.map((month) => (
              <Fragment key={`month-${month.key}`}>
                <tr
                  className="do-portfolio-finance-break is-month"
                  data-testid={`portfolio-finance-month-${month.key}`}
                >
                  {renderBreakCells(
                    `${month.label} · ${month.lineCount} lines`,
                    month.cost,
                    month.price,
                    "month",
                  )}
                </tr>
                {month.projects.map((project) => (
                  <Fragment key={`${month.key}-${project.key}`}>
                    {project.rows.map((row) => (
                      <tr
                        className={`do-portfolio-finance-row ${
                          row.billed ? "is-billed" : ""
                        } ${activeLineId === row.id ? "is-highlighted" : ""}`}
                        data-finance-line-id={row.id}
                        data-testid={
                          row.billed
                            ? "portfolio-finance-row-billed"
                            : "portfolio-finance-row"
                        }
                        key={row.id}
                      >
                        {financeVisibleColumns.map((column) =>
                          renderEditableCell(row, column),
                        )}
                      </tr>
                    ))}
                    <tr
                      className="do-portfolio-finance-break is-project"
                      data-testid={`portfolio-finance-project-total-${month.key}-${project.key}`}
                    >
                      {renderBreakCells(
                        `Project total · ${project.label}`,
                        project.cost,
                        project.price,
                        "project",
                      )}
                    </tr>
                  </Fragment>
                ))}
                <tr
                  className="do-portfolio-finance-break is-month-total"
                  data-testid={`portfolio-finance-month-total-${month.key}`}
                >
                  {renderBreakCells(
                    `${month.label} total`,
                    month.cost,
                    month.price,
                    "month",
                  )}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>

        {portfolioFinanceFilteredRows.length === 0 && (
          <EmptyState
            icon={<LayoutGrid size={20} />}
            title="No financial lines in this view"
            text="Adjust filters — or open a project ledger to add cost lines."
          />
        )}
      </div>

      {followUpRow &&
        createPortal(
          <div
            className="do-item-modal-backdrop"
            data-testid="finance-followup-modal"
            onClick={() => !followUpBusy && setFollowUpRow(null)}
          >
            <div
              aria-label="Create finance follow-up"
              aria-modal="true"
              className="do-item-modal do-portfolio-finance-followup-modal"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <header>
                <div>
                  <span className="do-project-card-kicker">FOLLOW-UP PBI</span>
                  <strong>Assign tracking for this finance line</strong>
                  <small>
                    Creates a PBI in My Work for you and whoever you assign. From
                    My Work you can jump back to this exact finance line.
                  </small>
                  <small>
                    {followUpRow.project} · {followUpRow.monthLabel} ·{" "}
                    {followUpRow.type}
                  </small>
                </div>
                <button
                  aria-label="Close"
                  disabled={followUpBusy}
                  onClick={() => setFollowUpRow(null)}
                  type="button"
                >
                  <X size={14} />
                </button>
              </header>
              <label>
                Title
                <input
                  onChange={(event) => setFollowUpTitle(event.target.value)}
                  value={followUpTitle}
                />
              </label>
              <label>
                Notes for the assignee
                <textarea
                  onChange={(event) => setFollowUpNotes(event.target.value)}
                  placeholder="What needs follow-up? Billing, vendor pay, invoice mismatch…"
                  rows={4}
                  value={followUpNotes}
                />
              </label>
              <MultiAssigneePicker
                label="Assign to"
                members={workspaceMembers}
                onChange={(ids, names) => {
                  setFollowUpAssigneeIds(ids);
                  setFollowUpAssigneeNames(names);
                }}
                selectedIds={followUpAssigneeIds}
                selectedNames={followUpAssigneeNames}
              />
              <footer>
                <button
                  disabled={followUpBusy}
                  onClick={() => setFollowUpRow(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="is-primary"
                  disabled={followUpBusy || !followUpTitle.trim() || !onAddTask}
                  onClick={() => void submitFollowUp()}
                  type="button"
                >
                  <ListChecks size={13} />
                  {followUpBusy ? "Creating…" : "Create PBI in My Work"}
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

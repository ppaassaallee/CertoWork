import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Papa from "papaparse";
import {
  DAvatar,
  DButton,
  DPill,
  DSegmented,
  DSheet,
  DTable,
  DTabs,
} from "../../desktop/ui";
import { OdysseusSignalsPanel } from "../signals";
import { useBillingEnabled } from "../flags/featureUserFlags";
import {
  filterByTab,
  listInvoices,
  markReminderSent,
  outstandingSum,
  updateInvoiceStatus,
} from "./invoiceStore";
import { daysOverdue, type Invoice } from "./types";
import { AddViewPopover, type ViewType } from "../../shared/views/AddViewPopover";
import "./billing.css";

function money(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$${n.toLocaleString()}`;
  }
}

function pillTone(status: Invoice["status"]) {
  if (status === "paid") return "paid" as const;
  if (status === "overdue") return "overdue" as const;
  if (status === "pending" || status === "sent") return "pending" as const;
  if (status === "cancelled") return "cancelled" as const;
  return "draft" as const;
}

export function BillingScreen({
  workspaceId,
  workspaceName,
  projectFilter: projectFilterProp,
  uid,
}: {
  workspaceId: string;
  workspaceName: string;
  projectFilter?: string;
  uid?: string;
}) {
  const enabled = useBillingEnabled();
  const [params] = useSearchParams();
  const projectFilter = projectFilterProp || params.get("project") || undefined;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tab, setTab] = useState("all");
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Invoice | null>(null);
  const [search, setSearch] = useState("");
  const [showAddView, setShowAddView] = useState(false);
  const [extraViews, setExtraViews] = useState<Array<{ id: string; type: ViewType; name: string }>>([]);

  useEffect(() => {
    if (!enabled || !workspaceId) return;
    let cancelled = false;
    (async () => {
      const rows = await listInvoices(workspaceId);
      if (cancelled) return;
      setInvoices(projectFilter ? rows.filter((r) => r.projectId === projectFilter) : rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, workspaceId, projectFilter]);

  const reload = async () => {
    const rows = await listInvoices(workspaceId);
    setInvoices(projectFilter ? rows.filter((r) => r.projectId === projectFilter) : rows);
  };

  const filtered = useMemo(() => {
    let rows = filterByTab(invoices, tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (i) =>
          i.number.toLowerCase().includes(q) ||
          (i.clientName || i.clientId || "").toLowerCase().includes(q) ||
          (i.projectName || i.projectId || "").toLowerCase().includes(q) ||
          (i.description || "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [invoices, tab, search]);

  const outstanding = outstandingSum(invoices);
  const overdue = invoices.filter((i) => i.status === "overdue");
  const recurring = invoices
    .filter((i) => i.type === "recurring" && i.status !== "cancelled")
    .reduce((s, i) => s + i.amount, 0);

  const counts = {
    all: invoices.length,
    upcoming: filterByTab(invoices, "upcoming").length,
    pending: filterByTab(invoices, "pending").length,
    overdue: overdue.length,
    paid: filterByTab(invoices, "paid").length,
  };

  const spark = useMemo(() => {
    const months: Array<{ m: string; v: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const v = invoices
        .filter((inv) => inv.type === "recurring" && (inv.periodStart || inv.issueDate || "").startsWith(key))
        .reduce((s, inv) => s + inv.amount, 0);
      months.push({ m: key.slice(5), v: v || recurring / 12 });
    }
    return months;
  }, [invoices, recurring]);

  if (!enabled) {
    return (
      <div className="billing-off" data-testid="billing-flag-off">
        <p>Billing is off. Enable <code>flags.billing</code> on your user doc.</p>
      </div>
    );
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedRows = filtered.filter((i) => selected.has(i.id));
  const selectedSum = selectedRows.reduce((s, i) => s + i.amount, 0);

  const exportCsv = () => {
    const rows = (selectedRows.length ? selectedRows : filtered).map((i) => ({
      number: i.number,
      status: i.status,
      dueDate: i.dueDate,
      client: i.clientName || i.clientId,
      project: i.projectName || i.projectId,
      description: i.description,
      amount: i.amount,
      currency: i.currency,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "certo-invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendReminder = async (inv: Invoice) => {
    const subject = encodeURIComponent(`Reminder: ${inv.number} due ${inv.dueDate}`);
    const body = encodeURIComponent(
      `Hi,\n\nThis is a reminder that invoice ${inv.number} for ${money(inv.amount, inv.currency)} was due on ${inv.dueDate}.\n\nThank you.`,
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
    await markReminderSent(inv.id, inv.reminderCount || 0);
    await reload();
  };

  const viewTabs = [
    { id: "list", label: "List" },
    { id: "board", label: "Board" },
    { id: "calendar", label: "Calendar" },
    { id: "chart", label: "Chart" },
    ...extraViews.map((v) => ({ id: v.id, label: v.name })),
    { id: "add", label: "+ View" },
  ];

  return (
    <div className="billing-screen d-root" data-testid="billing-screen">
      <div className="billing-main">
        <header className="billing-top">
          <h1>
            Billing <span className="muted">· {workspaceName}</span>
          </h1>
          <DButton
            onClick={() =>
              setActive({
                id: "",
                workspaceId,
                number: "New",
                projectId: "",
                clientId: "",
                deliveryEntity: "",
                type: "one-time",
                description: "",
                amount: 0,
                currency: "USD",
                issueDate: new Date().toISOString().slice(0, 10),
                dueDate: new Date().toISOString().slice(0, 10),
                status: "draft",
                reminderCount: 0,
              })
            }
          >
            Invoice
          </DButton>
        </header>

        <section className="billing-hero">
          <div>
            <p className="billing-headline">
              <span className="mono">{money(outstanding)}</span>{" "}
              <span className="conn">outstanding across</span>{" "}
              <strong>
                {invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled" && i.status !== "draft").length}{" "}
                invoices
              </strong>
              .
            </p>
            <p className="billing-sub">
              <span className="mono">{money(recurring)}</span> recurring this month ·{" "}
              {new Set(invoices.map((i) => i.projectId)).size} projects · {overdue.length} overdue
            </p>
          </div>
          <div className="billing-spark" aria-label={`Recurring ${money(recurring)}`}>
            <div className="spark-label">
              Recurring <span className="mono">{money(recurring)}</span>
            </div>
            <ResponsiveContainer height={64} width="100%">
              <AreaChart data={spark}>
                <Area dataKey="v" fill="rgba(37,71,196,.15)" stroke="#2547C4" strokeWidth={2} type="monotone" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="billing-views">
          <DTabs
            onChange={(id) => {
              if (id === "add") setShowAddView(true);
              else setView(id);
            }}
            options={viewTabs}
            value={view === "add" ? "list" : view}
          />
          {showAddView ? (
            <AddViewPopover
              onClose={() => setShowAddView(false)}
              onSelect={(type, name) => {
                setExtraViews((v) => [...v, { id: `v-${Date.now()}`, type, name }]);
                setView(`v-${Date.now()}`);
                setShowAddView(false);
              }}
              scope="invoices"
            />
          ) : null}
        </div>

        <div className="billing-toolbar">
          <DSegmented
            onChange={setTab}
            options={[
              { id: "all", label: `All (${counts.all})` },
              { id: "upcoming", label: `Upcoming (${counts.upcoming})` },
              { id: "pending", label: `Pending (${counts.pending})` },
              { id: "overdue", label: `Overdue (${counts.overdue})` },
              { id: "paid", label: `Paid (${counts.paid})` },
            ]}
            value={tab}
          />
          <input
            aria-label="Search invoices"
            className="billing-search"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="number, client, project…"
            value={search}
          />
        </div>

        {selected.size > 0 ? (
          <div className="billing-bulk">
            <span>
              {selected.size} selected · <span className="mono">{money(selectedSum)}</span>
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <DButton
                onClick={() => selectedRows.forEach((i) => void sendReminder(i))}
                size="sm"
                variant="secondary"
              >
                Send reminder
              </DButton>
              <DButton
                onClick={async () => {
                  for (const i of selectedRows) await updateInvoiceStatus(i.id, "paid");
                  setSelected(new Set());
                  await reload();
                }}
                size="sm"
              >
                Mark as paid
              </DButton>
              <DButton onClick={exportCsv} size="sm" variant="ghost">
                Export
              </DButton>
            </div>
          </div>
        ) : null}

        {view === "list" || view.startsWith("v-") ? (
          <DTable
            columns={[
              { id: "due", label: "Due" },
              { id: "num", label: "Invoice" },
              { id: "status", label: "Status" },
              { id: "desc", label: "Description" },
              { id: "client", label: "Client" },
              { id: "amt", label: "Amount", numeric: true },
            ]}
            onRowClick={(id) => setActive(filtered.find((i) => i.id === id) || null)}
            onToggle={toggle}
            rows={filtered.map((i) => ({
              id: i.id,
              cells: {
                due: (
                  <span className={i.status === "overdue" ? "due-bad" : undefined}>{i.dueDate}</span>
                ),
                num: <span className="mono">{i.number}</span>,
                status: (
                  <DPill tone={pillTone(i.status)}>
                    {i.status === "overdue"
                      ? `Overdue · ${daysOverdue(i.dueDate)}d`
                      : i.status.charAt(0).toUpperCase() + i.status.slice(1)}
                  </DPill>
                ),
                desc: (
                  <span>
                    {i.description}
                    <br />
                    <span className="sub">{i.projectName || i.projectId}</span>
                  </span>
                ),
                client: (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <DAvatar label={i.clientName || i.clientId || "?"} />
                    {i.clientName || i.clientId || "—"}
                  </span>
                ),
                amt: money(i.amount, i.currency),
              },
            }))}
            selected={selected}
          />
        ) : null}

        {view === "board" ? (
          <div className="billing-board">
            {(["draft", "pending", "sent", "overdue", "paid"] as const).map((col) => (
              <div className="billing-col" key={col}>
                <h4>{col}</h4>
                {filtered
                  .filter((i) => i.status === col || (col === "pending" && i.status === "sent"))
                  .map((i) => (
                    <button
                      className="billing-card"
                      key={i.id}
                      onClick={() => setActive(i)}
                      type="button"
                    >
                      <span className="mono">{i.number}</span>
                      <span>{i.clientName || i.clientId}</span>
                      <strong className="mono">{money(i.amount, i.currency)}</strong>
                      <span className="sub">{i.dueDate}</span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        ) : null}

        {view === "calendar" ? <BillingCalendar invoices={filtered} /> : null}

        {view === "chart" ? <BillingChart invoices={invoices} /> : null}
      </div>

      <OdysseusSignalsPanel
        contextChips={["How does this month compare to last?", "Who pays late?", "Draft a reminder"]}
        uid={uid}
        workspaceId={workspaceId}
      />

      <InvoiceDrawer
        invoice={active}
        onClose={() => setActive(null)}
        onPaid={async () => {
          if (!active?.id) return;
          await updateInvoiceStatus(active.id, "paid");
          setActive(null);
          await reload();
        }}
        onReminder={() => active && void sendReminder(active)}
        onSent={async () => {
          if (!active?.id) return;
          await updateInvoiceStatus(active.id, "sent");
          await reload();
        }}
      />
    </div>
  );
}

function InvoiceDrawer({
  invoice,
  onClose,
  onPaid,
  onReminder,
  onSent,
}: {
  invoice: Invoice | null;
  onClose: () => void;
  onPaid: () => void;
  onReminder: () => void;
  onSent: () => void;
}) {
  if (!invoice) return null;
  const overdue = invoice.status === "overdue";
  const days = overdue ? daysOverdue(invoice.dueDate) : null;
  return (
    <DSheet
      footer={
        <div style={{ display: "flex", gap: 8 }}>
          <DButton onClick={onPaid}>Mark as paid</DButton>
          <DButton onClick={onReminder} variant="secondary">
            Send reminder
          </DButton>
          <DButton onClick={onSent} variant="ghost">
            Mark as sent
          </DButton>
        </div>
      }
      onClose={onClose}
      open={!!invoice}
      title={invoice.number}
    >
      <div style={{ marginBottom: 12 }}>
        <DPill tone={pillTone(invoice.status)}>{invoice.status}</DPill>
      </div>
      <dl className="inv-props">
        <div>
          <dt>Client</dt>
          <dd>{invoice.clientName || invoice.clientId || "—"}</dd>
        </div>
        <div>
          <dt>Project</dt>
          <dd>{invoice.projectName || invoice.projectId || "—"}</dd>
        </div>
        <div>
          <dt>Entity</dt>
          <dd>{invoice.deliveryEntity || "—"}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{invoice.type}</dd>
        </div>
        <div>
          <dt>Due date</dt>
          <dd>
            {invoice.dueDate}
            {days != null ? ` · ${days} days overdue` : ""}
          </dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd className="mono">{money(invoice.amount, invoice.currency)}</dd>
        </div>
      </dl>
      <p>{invoice.description}</p>
      {invoice.notes ? <p className="sub">{invoice.notes}</p> : null}
    </DSheet>
  );
}

function BillingCalendar({ invoices }: { invoices: Invoice[] }) {
  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of invoices) {
      map.set(i.dueDate, (map.get(i.dueDate) || 0) + i.amount);
    }
    return map;
  }, [invoices]);
  const start = new Date();
  start.setDate(1);
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { day, key, sum: byDay.get(key) || 0 };
  });
  return (
    <div className="billing-cal" role="grid" aria-label="Invoice due dates this month">
      {cells.map((c) => (
        <div className="billing-cal-cell" key={c.key}>
          <span>{c.day}</span>
          {c.sum ? <span className="mono">{money(c.sum)}</span> : null}
        </div>
      ))}
    </div>
  );
}

function BillingChart({ invoices }: { invoices: Invoice[] }) {
  const data = useMemo(() => {
    const months: Array<{ m: string; billed: number; collected: number; outstanding: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthInvs = invoices.filter((inv) => (inv.issueDate || "").startsWith(key));
      const billed = monthInvs.reduce((s, x) => s + x.amount, 0);
      const collected = monthInvs.filter((x) => x.status === "paid").reduce((s, x) => s + x.amount, 0);
      months.push({
        m: key.slice(5),
        billed,
        collected,
        outstanding: billed - collected,
      });
    }
    return months;
  }, [invoices]);
  return (
    <div style={{ height: 280, background: "#fff", borderRadius: 14, padding: 12, border: "1px solid var(--c-line)" }}>
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="#ECEEF3" vertical={false} />
          <XAxis dataKey="m" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="billed" fill="#2547C4" name="Billed" />
          <Bar dataKey="collected" fill="#3AAE6C" name="Collected" />
          <Bar dataKey="outstanding" fill="#F2620F" name="Outstanding" />
        </BarChart>
      </ResponsiveContainer>
      <p className="sr-only">
        Chart of billed versus collected amounts for the last six months with outstanding trend.
      </p>
    </div>
  );
}

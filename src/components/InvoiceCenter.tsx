import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Flag,
  Plus,
  Send,
} from "./ui/Icon";
import {
  INVOICE_EXCEPTION_CODES,
  canTransitionInvoice,
  clientActionsForStatus,
  financeActionsForStatus,
  filterInvoiceQueue,
  invoiceExceptionLabel,
  invoicePaymentLabel,
  invoicePortalPath,
  invoiceQueueCounts,
  invoiceStatusLabel,
  isInvoiceOverdue,
  type InvoiceDocument,
  type InvoiceExceptionCode,
  type InvoiceQueueFilter,
  type InvoiceStatus,
  type PendingInvoiceLine,
} from "../lib/invoiceDocuments";

type StatusPatch = {
  status: InvoiceStatus;
  settledAmount?: number;
  settledDate?: string;
  remittanceRef?: string;
  exceptionCode?: InvoiceExceptionCode | "";
  exceptionNote?: string;
  rejectionReason?: string;
  adminNote?: string;
};

type Props = {
  canOperate: boolean;
  invoices: InvoiceDocument[];
  pending: PendingInvoiceLine[];
  busyId?: string;
  onPush: (line: PendingInvoiceLine) => Promise<void> | void;
  onUpdateStatus: (invoice: InvoiceDocument, patch: StatusPatch) => Promise<void> | void;
  onOpenProject?: (projectId: string) => void;
};

const TILES: Array<{ id: InvoiceQueueFilter; label: string }> = [
  { id: "ready", label: "Ready to push" },
  { id: "open", label: "In process" },
  { id: "overdue", label: "Overdue" },
  { id: "billed", label: "Billed" },
  { id: "sent", label: "Sent" },
  { id: "pending_approval", label: "Pending approval" },
  { id: "approved", label: "Approved" },
  { id: "paid", label: "Paid" },
  { id: "exception", label: "Problem" },
  { id: "rejected", label: "Rejected" },
  { id: "void", label: "Void" },
  { id: "all", label: "All" },
];

function money(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    return `${currency} ${(amount || 0).toLocaleString()}`;
  }
}

function actionLabel(status: InvoiceStatus) {
  if (status === "sent") return "Send to client";
  if (status === "pending_approval") return "Mark pending approval";
  if (status === "approved") return "Approve for payment";
  if (status === "paid") return "Mark paid";
  if (status === "rejected") return "Reject";
  if (status === "void") return "Void";
  if (status === "exception") return "Flag problem";
  if (status === "billed") return "Return to billed";
  return invoiceStatusLabel(status);
}

export function InvoiceCenter({
  canOperate,
  invoices,
  pending,
  busyId = "",
  onPush,
  onUpdateStatus,
  onOpenProject,
}: Props) {
  const [filter, setFilter] = useState<InvoiceQueueFilter>("ready");
  const [nextStatusById, setNextStatusById] = useState<Record<string, InvoiceStatus>>({});
  const [paidAmountById, setPaidAmountById] = useState<Record<string, string>>({});
  const [paidDateById, setPaidDateById] = useState<Record<string, string>>({});
  const [remitById, setRemitById] = useState<Record<string, string>>({});
  const [exceptionCodeById, setExceptionCodeById] = useState<Record<string, InvoiceExceptionCode>>(
    {},
  );
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState("");

  const counts = useMemo(
    () => invoiceQueueCounts(invoices, pending.length),
    [invoices, pending.length],
  );
  const queued = useMemo(
    () =>
      filterInvoiceQueue(invoices, filter).sort((left, right) => {
        const leftDue = String(left.dueDate || "");
        const rightDue = String(right.dueDate || "");
        return leftDue.localeCompare(rightDue);
      }),
    [invoices, filter],
  );

  const copyPortal = async (invoice: InvoiceDocument) => {
    const token = invoice.shareToken || invoice.id;
    const url = `${window.location.origin}${invoicePortalPath(token)}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(invoice.id);
  };

  const apply = (invoice: InvoiceDocument) => {
    const status =
      nextStatusById[invoice.id] || financeActionsForStatus(invoice.status)[0];
    if (!status || !canTransitionInvoice(invoice.status, status, "finance")) return;
    const settledAmount = Number(paidAmountById[invoice.id] || invoice.amount || 0);
    onUpdateStatus(invoice, {
      status,
      settledAmount: status === "paid" ? settledAmount : invoice.settledAmount,
      settledDate:
        status === "paid"
          ? paidDateById[invoice.id] || new Date().toISOString().slice(0, 10)
          : invoice.settledDate,
      remittanceRef: remitById[invoice.id] || invoice.remittanceRef,
      exceptionCode: status === "exception" ? exceptionCodeById[invoice.id] || "other" : "",
      exceptionNote: status === "exception" ? noteById[invoice.id] || "" : invoice.exceptionNote,
      rejectionReason: status === "rejected" ? noteById[invoice.id] || "" : invoice.rejectionReason,
    });
  };

  return (
    <div className="do-invoice-center" data-testid="invoice-finance-queue">
      <header className="do-invoice-head">
        <span className="do-kicker">Finance</span>
        <h1>Invoices</h1>
        <p>
          Push pending project invoices into the AP queue, then move them the way Ariba
          does: billed, sent, pending approval, approved, paid — or rejected, voided, or
          held as a problem. Clients can update payment from a share link.
        </p>
      </header>

      <div className="do-invoice-tiles" role="tablist" aria-label="Invoice queue">
        {TILES.map((tile) => (
          <button
            className={filter === tile.id ? "is-active" : ""}
            key={tile.id}
            onClick={() => setFilter(tile.id)}
            role="tab"
            type="button"
          >
            <strong>{counts[tile.id]}</strong>
            <span>{tile.label}</span>
          </button>
        ))}
      </div>

      {filter === "ready" && (
        <section className="do-workspace-admin-card" aria-label="Pending invoices">
          <div className="do-workspace-admin-head">
            <span className="do-kicker">Project ledger</span>
            <strong>{pending.length} ready to push</strong>
          </div>
          <div className="do-invoice-list">
            {pending.map((line) => (
              <article className="do-invoice-row" key={`${line.projectId}:${line.entryId}`}>
                <span className="do-invoice-chip is-ready">Pending</span>
                <div>
                  <strong>{line.title}</strong>
                  <p>
                    {line.projectTitle}
                    {line.clientName ? ` · ${line.clientName}` : ""}
                    {line.periodLabel ? ` · ${line.periodLabel}` : ""}
                    {line.invoiceNumber ? ` · ${line.invoiceNumber}` : ""}
                  </p>
                  <small>
                    {money(line.amount, line.currency)}
                    {line.dueDate ? ` · due ${line.dueDate}` : ""}
                  </small>
                </div>
                <div className="do-invoice-actions">
                  {onOpenProject && (
                    <button onClick={() => onOpenProject(line.projectId)} type="button">
                      Open project
                    </button>
                  )}
                  {canOperate && (
                    <button
                      className="is-primary"
                      disabled={busyId === `${line.projectId}:${line.entryId}`}
                      onClick={() => void onPush(line)}
                      type="button"
                    >
                      <Plus size={12} /> Push to AP
                    </button>
                  )}
                </div>
              </article>
            ))}
            {pending.length === 0 && (
              <div className="do-panel-empty">
                <FileText size={20} />
                <strong>No pending invoices.</strong>
                <span>
                  Add a billing line on a project finance ledger, then push it here for
                  finance to issue and collect.
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {filter !== "ready" && (
        <section className="do-workspace-admin-card" aria-label="Invoice documents">
          <div className="do-workspace-admin-head">
            <span className="do-kicker">AP queue</span>
            <strong>{queued.length} shown</strong>
          </div>
          <div className="do-invoice-list">
            {queued.map((invoice) => {
              const actions = canOperate
                ? financeActionsForStatus(invoice.status)
                : clientActionsForStatus(invoice.status);
              const selected =
                nextStatusById[invoice.id] || actions[0] || (invoice.status as InvoiceStatus);
              const overdue = isInvoiceOverdue(invoice);
              return (
                <article className="do-invoice-row" key={invoice.id}>
                  <span className={`do-invoice-chip is-${invoice.status || "billed"}`}>
                    {invoice.status === "exception" ? <AlertTriangle size={12} /> : <FileText size={12} />}
                    {invoiceStatusLabel(invoice.status)}
                    {overdue ? " · overdue" : ""}
                  </span>
                  <div>
                    <strong>
                      {invoice.invoiceNumber || "Unnumbered"} · {invoice.title || "Invoice"}
                    </strong>
                    <p>
                      {invoice.clientName || "Internal"}
                      {invoice.dueDate ? ` · due ${invoice.dueDate}` : ""}
                      {` · ${invoicePaymentLabel(overdue ? "overdue" : invoice.paymentStatus)}`}
                    </p>
                    <small>
                      {money(Number(invoice.amount || 0), invoice.currency || "USD")}
                      {Number(invoice.settledAmount || 0) > 0
                        ? ` · collected ${money(Number(invoice.settledAmount || 0), invoice.currency || "USD")}`
                        : ""}
                      {invoice.exceptionCode
                        ? ` · ${invoiceExceptionLabel(invoice.exceptionCode)}`
                        : ""}
                    </small>
                  </div>
                  <div className="do-invoice-actions">
                    <button onClick={() => void copyPortal(invoice)} type="button">
                      {copiedId === invoice.id ? <Check size={12} /> : <Copy size={12} />}
                      {copiedId === invoice.id ? "Copied portal" : "Copy client portal"}
                    </button>
                    <a href={invoicePortalPath(invoice.shareToken || invoice.id)} rel="noreferrer">
                      <ExternalLink size={12} /> Open portal
                    </a>
                    {onOpenProject && invoice.projectId && (
                      <button onClick={() => onOpenProject(invoice.projectId as string)} type="button">
                        Open project
                      </button>
                    )}
                    {canOperate && actions.length > 0 && (
                      <>
                        <select
                          aria-label={`Next status for ${invoice.invoiceNumber || invoice.title}`}
                          onChange={(event) =>
                            setNextStatusById((current) => ({
                              ...current,
                              [invoice.id]: event.target.value as InvoiceStatus,
                            }))
                          }
                          value={selected}
                        >
                          {actions.map((status) => (
                            <option key={status} value={status}>
                              {actionLabel(status)}
                            </option>
                          ))}
                        </select>
                        {selected === "paid" && (
                          <>
                            <input
                              aria-label="Paid amount"
                              onChange={(event) =>
                                setPaidAmountById((current) => ({
                                  ...current,
                                  [invoice.id]: event.target.value,
                                }))
                              }
                              placeholder="Paid amount"
                              type="number"
                              value={paidAmountById[invoice.id] ?? String(invoice.amount || 0)}
                            />
                            <input
                              aria-label="Paid date"
                              onChange={(event) =>
                                setPaidDateById((current) => ({
                                  ...current,
                                  [invoice.id]: event.target.value,
                                }))
                              }
                              type="date"
                              value={
                                paidDateById[invoice.id] ||
                                invoice.settledDate ||
                                new Date().toISOString().slice(0, 10)
                              }
                            />
                            <input
                              aria-label="Remittance reference"
                              onChange={(event) =>
                                setRemitById((current) => ({
                                  ...current,
                                  [invoice.id]: event.target.value,
                                }))
                              }
                              placeholder="Remittance / payment ref"
                              value={remitById[invoice.id] ?? invoice.remittanceRef ?? ""}
                            />
                          </>
                        )}
                        {selected === "exception" && (
                          <select
                            aria-label="Exception reason"
                            onChange={(event) =>
                              setExceptionCodeById((current) => ({
                                ...current,
                                [invoice.id]: event.target.value as InvoiceExceptionCode,
                              }))
                            }
                            value={exceptionCodeById[invoice.id] || "other"}
                          >
                            {INVOICE_EXCEPTION_CODES.map((code) => (
                              <option key={code} value={code}>
                                {invoiceExceptionLabel(code)}
                              </option>
                            ))}
                          </select>
                        )}
                        {(selected === "exception" ||
                          selected === "rejected" ||
                          selected === "void") && (
                          <input
                            aria-label="Status note"
                            onChange={(event) =>
                              setNoteById((current) => ({
                                ...current,
                                [invoice.id]: event.target.value,
                              }))
                            }
                            placeholder={
                              selected === "void"
                                ? "Void reason"
                                : selected === "rejected"
                                  ? "Rejection reason"
                                  : "Problem note"
                            }
                            value={noteById[invoice.id] || ""}
                          />
                        )}
                        <button
                          className="is-primary"
                          disabled={busyId === invoice.id}
                          onClick={() => apply(invoice)}
                          type="button"
                        >
                          {selected === "sent" ? <Send size={12} /> : <Flag size={12} />}
                          Apply
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
            {queued.length === 0 && (
              <div className="do-panel-empty">
                <FileText size={20} />
                <strong>Nothing in this filter.</strong>
                <span>Push a pending project invoice, or choose another status tile.</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  INVOICE_EXCEPTION_CODES,
  canTransitionInvoice,
  clientActionsForStatus,
  invoiceExceptionLabel,
  invoicePaymentLabel,
  invoiceStatusLabel,
  isInvoiceOverdue,
  paymentStatusForInvoice,
  type InvoiceDocument,
  type InvoiceExceptionCode,
  type InvoiceStatus,
} from "../lib/invoiceDocuments";

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

export function PublicInvoicePortal({ token }: { token: string }) {
  const [invoice, setInvoice] = useState<InvoiceDocument | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("paid");
  const [settledAmount, setSettledAmount] = useState("");
  const [settledDate, setSettledDate] = useState(new Date().toISOString().slice(0, 10));
  const [remittanceRef, setRemittanceRef] = useState("");
  const [exceptionCode, setExceptionCode] = useState<InvoiceExceptionCode>("other");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const snap = await getDoc(doc(db, "invoice_documents", token));
        const data = snap.exists() ? ({ id: snap.id, ...snap.data() } as InvoiceDocument) : null;
        if (!data || data.revoked || data.shareToken !== token) {
          throw new Error("This invoice link is invalid or has been revoked.");
        }
        if (!active) return;
        setInvoice(data);
        const actions = clientActionsForStatus(data.status);
        setStatus(actions[0] || "paid");
        setSettledAmount(String(data.amount || 0));
        setRemittanceRef(String(data.remittanceRef || ""));
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "This invoice could not be opened.");
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [token]);

  const submit = async () => {
    if (!invoice) return;
    if (!canTransitionInvoice(invoice.status, status, "client")) {
      setNotice("This invoice cannot be updated from the client portal in its current status.");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const amount = Number(settledAmount || invoice.amount || 0);
      await updateDoc(doc(db, "invoice_documents", invoice.id), {
        shareToken: token,
        status,
        paymentStatus: paymentStatusForInvoice(
          status,
          amount,
          Number(invoice.amount || 0),
          isInvoiceOverdue({ ...invoice, status }),
        ),
        settledAmount: status === "paid" ? amount : invoice.settledAmount || 0,
        settledDate: status === "paid" ? settledDate : invoice.settledDate || "",
        remittanceRef: remittanceRef.trim(),
        exceptionCode: status === "exception" ? exceptionCode : "",
        exceptionNote: status === "exception" ? note.trim() : "",
        rejectionReason: status === "rejected" ? note.trim() : "",
        clientNote: note.trim(),
        clientUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setInvoice({
        ...invoice,
        status,
        settledAmount: status === "paid" ? amount : invoice.settledAmount,
        remittanceRef: remittanceRef.trim(),
      });
      setNotice(
        status === "paid"
          ? "Payment recorded. Finance will see this on the invoice queue."
          : status === "rejected"
            ? "Rejection sent to finance."
            : "Problem flagged for finance.",
      );
    } catch (reason) {
      setNotice(
        reason instanceof Error ? reason.message : "The payment update could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <main className="do-signin">
        <section className="do-access-card" style={{ margin: "12vh auto", maxWidth: 480 }}>
          <h2>Invoice unavailable</h2>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="do-loading">
        <span className="do-logo">C</span>
        <p>Opening invoice…</p>
      </main>
    );
  }

  const actions = clientActionsForStatus(invoice.status);
  const overdue = isInvoiceOverdue(invoice);

  return (
    <main className="do-invoice-portal" data-testid="invoice-client-portal">
      <header className="do-invoice-portal-bar">
        <span>Certo Work · client invoice portal</span>
        <strong>{invoice.invoiceNumber || "Invoice"}</strong>
      </header>
      <section className="do-access-card do-invoice-portal-card">
        <span className="do-kicker">Invoice status</span>
        <h1>{invoice.title || "Invoice"}</h1>
        <p>
          {invoice.clientName || "Client"} · {money(Number(invoice.amount || 0), invoice.currency || "USD")}
        </p>
        <dl className="do-invoice-portal-meta">
          <div>
            <dt>Status</dt>
            <dd>
              {invoiceStatusLabel(invoice.status)}
              {overdue ? " · overdue" : ""}
            </dd>
          </div>
          <div>
            <dt>Payment</dt>
            <dd>{invoicePaymentLabel(overdue ? "overdue" : invoice.paymentStatus)}</dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd>{invoice.dueDate || "—"}</dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{invoice.issueDate || "—"}</dd>
          </div>
        </dl>
        {actions.length === 0 ? (
          <p className="do-panel-intro">
            This invoice is {invoiceStatusLabel(invoice.status).toLowerCase()}. Payment updates are
            closed on the client portal.
          </p>
        ) : (
          <>
            <p className="do-panel-intro">
              Confirm a payment, reject this invoice, or flag a problem. Finance keeps billed,
              sent, approved, and void in the internal queue.
            </p>
            <label>
              Update
              <select
                aria-label="Client invoice action"
                onChange={(event) => setStatus(event.target.value as InvoiceStatus)}
                value={status}
              >
                {actions.map((value) => (
                  <option key={value} value={value}>
                    {value === "paid"
                      ? "Confirm paid"
                      : value === "rejected"
                        ? "Reject invoice"
                        : "Flag a problem"}
                  </option>
                ))}
              </select>
            </label>
            {status === "paid" && (
              <>
                <label>
                  Amount paid
                  <input
                    aria-label="Amount paid"
                    onChange={(event) => setSettledAmount(event.target.value)}
                    type="number"
                    value={settledAmount}
                  />
                </label>
                <label>
                  Payment date
                  <input
                    aria-label="Payment date"
                    onChange={(event) => setSettledDate(event.target.value)}
                    type="date"
                    value={settledDate}
                  />
                </label>
                <label>
                  Remittance / payment reference
                  <input
                    aria-label="Remittance reference"
                    onChange={(event) => setRemittanceRef(event.target.value)}
                    value={remittanceRef}
                  />
                </label>
              </>
            )}
            {status !== "paid" && (
              <>
                {status === "exception" && (
                  <label>
                    Problem
                    <select
                      aria-label="Problem reason"
                      onChange={(event) =>
                        setExceptionCode(event.target.value as InvoiceExceptionCode)
                      }
                      value={exceptionCode}
                    >
                      {INVOICE_EXCEPTION_CODES.map((code) => (
                        <option key={code} value={code}>
                          {invoiceExceptionLabel(code)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Note
                  <textarea
                    aria-label="Client note"
                    onChange={(event) => setNote(event.target.value)}
                    rows={4}
                    value={note}
                  />
                </label>
              </>
            )}
            <button
              className="do-button do-button-dark"
              disabled={saving}
              onClick={() => void submit()}
              type="button"
            >
              {saving ? "Saving…" : "Submit update"}
            </button>
          </>
        )}
        {notice && <p className="do-invoice-portal-notice">{notice}</p>}
      </section>
    </main>
  );
}

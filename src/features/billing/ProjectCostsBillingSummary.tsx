import { DButton } from "../../desktop/ui";

function moneyFmt(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${n.toLocaleString()}`;
  }
}

/** Projects › Costs summary when billing flag is on — KPI chips + Open in Billing. */
export function ProjectCostsBillingSummary({
  recurring,
  initialInvestment,
  outstanding,
  overdue,
  currency = "USD",
  onOpenBilling,
  onEditBilling,
}: {
  recurring: number;
  initialInvestment: number;
  outstanding: number;
  overdue: number;
  currency?: string;
  onOpenBilling: () => void;
  onEditBilling?: () => void;
}) {
  return (
    <div data-testid="project-costs-billing-summary" style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Chip label="Recurring" value={moneyFmt(recurring, currency)} />
        <Chip label="Initial" value={moneyFmt(initialInvestment, currency)} />
        <Chip label="Outstanding" value={moneyFmt(outstanding, currency)} />
        <Chip label="Overdue" value={String(overdue)} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <DButton onClick={onOpenBilling} size="sm">
          Open in Billing
        </DButton>
        {onEditBilling ? (
          <DButton onClick={onEditBilling} size="sm" variant="secondary">
            Edit billing
          </DButton>
        ) : null}
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        border: "1px solid var(--c-line)",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        background: "#fff",
      }}
    >
      {label}: <strong className="mono">{value}</strong>
    </span>
  );
}

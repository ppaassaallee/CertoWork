import { formatDirectionMoney, type DirectionData } from "../buildDirectionData";
import { DirectionEmpty, DirectionWidget } from "./DirectionWidget";

export function MoneyWidget({
  title,
  linkLabel,
  emptyLabel,
  money,
  labels,
  onOpen,
}: {
  title: string;
  linkLabel: string;
  emptyLabel: string;
  money: DirectionData["money"];
  labels: {
    invoiced: string;
    planned: string;
    overdue: string;
    footer: string;
  };
  onOpen(): void;
}) {
  const hasSignal = money.invoiced > 0 || money.planned > 0 || money.overdueInvoices > 0;
  const pct =
    money.planned > 0 ? Math.min(100, Math.round((money.invoiced / money.planned) * 100)) : 0;

  return (
    <DirectionWidget linkLabel={linkLabel} onLink={onOpen} testId="direction-money" title={title}>
      {!hasSignal ? (
        <DirectionEmpty label={emptyLabel} />
      ) : (
        <>
          <div className="cw-dir-money-grid">
            <div>
              <div className="cw-dir-big">{formatDirectionMoney(money.invoiced)}</div>
              <div className="cw-dir-sub">{labels.invoiced}</div>
            </div>
            <div>
              <div className="cw-dir-big is-muted">{formatDirectionMoney(money.planned)}</div>
              <div className="cw-dir-sub">{labels.planned}</div>
            </div>
            <div>
              <div className={`cw-dir-big${money.overdueInvoices ? " is-danger" : ""}`}>
                {money.overdueInvoices}
              </div>
              <div className="cw-dir-sub">{labels.overdue}</div>
            </div>
          </div>
          <span className="cw-dir-bar cw-dir-bar-full" aria-hidden>
            <i className="is-info" style={{ width: `${Math.max(pct, 2)}%` }} />
          </span>
          <p className="cw-dir-sub">{labels.footer}</p>
        </>
      )}
    </DirectionWidget>
  );
}

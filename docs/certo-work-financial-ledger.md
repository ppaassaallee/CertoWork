# Certo Work project financial ledger

The project console treats delivery economics as an auditable ledger instead of two project-level totals.

## Periods

- **Build / change request:** one period per commercial delivery package, such as Build V1, V2, CR1, or CR2.
- **Monthly operations:** one period for each month and year. Portfolio monthly cost uses the latest recorded month, while prior months remain available for audit and trend analysis.
- Each period has a status (`planned`, `active`, or `closed`) and currency.
- Calendar month and year use explicit selectors. A Build or change request can contain several invoice installments, each assigned to its own accounting month.

## Financial movements

Every period can contain both cost and revenue movements. A movement records:

- description and category;
- unit driver, planned quantity, actual quantity, and rate;
- calculated planned and actual amount;
- invoice, purchase-order, or bill reference;
- accounting month;
- issue date and due date;
- payment state;
- amount and date paid or collected.

Revenue, invoicing, and cash collection are distinct values. Registering a collection does not create a second revenue movement.

## Billing and payment states

- Period billing: not billed, draft, partially billed, billed, or void.
- Invoice: not billed, draft, invoiced, void, or uncollectible.
- Customer payment: unpaid, partial, paid, or overdue.
- Cost: planned, committed, incurred, paid, or void.
- Void movements do not affect project or portfolio totals.

Invoice status and payment status are deliberately separate. An invoice can be issued while still unpaid, partially paid, overdue, void, or uncollectible.

## Summaries

- **Actual cost:** actual quantity multiplied by rate for active cost movements.
- **Revenue:** actual quantity multiplied by rate for active revenue movements.
- **Invoiced:** issued revenue with an invoice reference or issued payment state.
- **Collected:** the sum of recorded collection amounts.
- **Outstanding:** invoiced minus collected, never below zero.
- **Margin:** revenue minus actual cost.

Budget rates and actual rates are stored separately. This makes quantity variance and rate variance visible without rewriting the approved baseline.

## Compatibility

Legacy cost rows are preserved. A project can convert its existing cost baseline into `Build V1 · legacy baseline` and continue in the new model without deleting the original fields. Reusable cost templates can seed a Build/CR period, be saved from a period, and be updated when the period originated from a custom template.

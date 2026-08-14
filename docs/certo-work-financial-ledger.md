# Certo Work project financial ledger

The project console treats delivery economics as an auditable ledger instead of two project-level totals.

## Periods

- **Build / change request:** one period per commercial delivery package, such as Build V1, V2, CR1, or CR2.
- **Monthly operations:** one period for each month and year. Portfolio monthly cost uses the latest recorded month, while prior months remain available for audit and trend analysis.
- Each period has a status (`planned`, `active`, or `closed`) and currency.

## Financial movements

Every period can contain both cost and revenue movements. A movement records:

- description and category;
- unit driver, planned quantity, actual quantity, and rate;
- calculated planned and actual amount;
- invoice, purchase-order, or bill reference;
- issue date and due date;
- payment state;
- amount and date paid or collected.

Revenue, invoicing, and cash collection are distinct values. Registering a collection does not create a second revenue movement.

## Payment states

- Revenue: planned, draft, issued, partial, paid, overdue, or void.
- Cost: planned, committed, incurred, paid, or void.
- Void movements do not affect project or portfolio totals.

## Summaries

- **Actual cost:** actual quantity multiplied by rate for active cost movements.
- **Revenue:** actual quantity multiplied by rate for active revenue movements.
- **Invoiced:** issued revenue with an invoice reference or issued payment state.
- **Collected:** the sum of recorded collection amounts.
- **Outstanding:** invoiced minus collected, never below zero.
- **Margin:** revenue minus actual cost.

## Compatibility

Legacy cost rows are preserved. A project can convert its existing cost baseline into `Build V1 · legacy baseline` and continue in the new model without deleting the original fields. Reusable cost templates can seed a Build/CR period, be saved from a period, and be updated when the period originated from a custom template.

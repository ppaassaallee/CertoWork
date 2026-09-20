# QA — Phase B (Billing)

- [ ] `allocateInvoiceNumber` sequential under concurrent creates (20 parallel callables).
- [ ] `flipOverdueInvoices` daily + client `deriveInvoiceStatus` on read.
- [ ] `generateProjectInvoices` creates exactly one recurring invoice per project per period.
- [ ] Status tab counts match filtered table.
- [ ] Bulk Mark as paid sets `paidAt`; reminders increment `reminderCount` and open mailto when mail not configured.
- [ ] CSV export (papaparse) opens with numeric amounts.
- [ ] Board / Calendar / Chart views render; calendar day sums = invoices due that day.
- [ ] Flag off → legacy `InvoiceCenter` at `/invoices`.
- [ ] Flag on → `BillingScreen` at `/billing`.
- [ ] Projects › Costs remains summary path; Open in Billing filters by project (when wired).
- [ ] Rules: counters write denied to clients; invoice read for members.

```bash
npx tsx scripts/seedProjectBilling.ts
npx tsx scripts/seedProjectBilling.ts --write
```

# Tables — Discovery

| # | Item | Path / Symbol | Gap vs prompt |
|---|------|---------------|---------------|
| 1 | Existing tables | `src/lib/tables/*`, `src/features/tables/*`, routes `/tables`, `/tables/:id` | Partial: grid/board/calendar/form/automations composer exist; missing groups UI, footer summaries, formula/lookup/rollup/AI columns, virtualization, dashboards, property-mgmt template |
| 2 | Routines engine | `src/lib/routines/types.ts` `RoutineSpec`, triggers include `table.record_created` / `table.status_changed` / `table.date_reached`; `TableAutomationComposer` | Need `structured` variant + table actions (set/notify/createRecord/forEach) on same executor; loop guard |
| 3 | Odysseus | `sendBoldiChat` / conversation client; `OdysseusPanel`; answer format in `renderOdysseusAnswer` | Need system-builder (template draft from description) |
| 4 | Entity links | `entity_links` collection; `src/lib/tables/storage.ts` link helpers; `src/lib/notes/storage.ts` | Exists — extend `record` type coverage |
| 5 | Items/projects/notes/invoices | Existing libs + Billing (`src/features/billing`) | Wire createInvoice action when billing on |
| 6 | Notify / email / Inbox | `user_notifications`, Brevo/`emailClient`, Phone Inbox | mailto fallback for email actions |
| 7 | Views | `src/lib/views/*` + `src/shared/views/AddViewPopover`; `RecordsViewSurface` | Extend scope `table` types: timeline/chart/gallery/form |
| 8 | Shell / kits | `DelivereeWorkspace` sidebar; `src/desktop/ui/`; `src/mobile/ui/` | Tables already under work; flag-gate visibility |
| 9 | Upload | Firebase Storage patterns in workspace | Reuse for files columns |
| 10 | Date / i18n | `date-fns`, `src/lib/i18n.ts` (`tables.*` keys) | Add new strings en/es |

## Flag
`users/{uid}.flags.tables` + `localStorage.certoTables=1` (mirror dailyBrief/billing).

## Assumptions
See `ASSUMPTIONS.md`.

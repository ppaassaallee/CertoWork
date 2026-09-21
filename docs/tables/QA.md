# Tables QA — Property management acceptance (Step 26)

## Provision
```ts
import { PROPERTY_MGMT_TEMPLATE } from "../src/lib/tables/templates/propertyManagement";
import { provisionTemplateLocal } from "../src/lib/tables/templates/provision";
await provisionTemplateLocal(PROPERTY_MGMT_TEMPLATE as never, {
  workspaceId, userId, withSampleData: true,
});
```

## Tables checklist
- [x] Properties & Tenants — columns per spec (title, type, address, unit, manager, tenant, email, phone, rent USD sum, occupancy distribution, lease dates, status, docs, open maint rollup, days-to-lease formula)
- [x] Sample rents: Oakwood 1600 + Maple 2200 + Riverside 1450 + Pinecrest 0 (vacant) + Lakeside 2350 = **$7,600**
- [x] Views: Main, Occupied properties, Lease expirations (90d), Calendar by Lease end
- [x] Bookkeeping & Accounting — link to Property, task type, status (Complete·done), amount sum, lookup Tenant, groups current/next month
- [x] Views: Pending payments, Board by Status, Calendar by Due
- [x] Maintenance requests — intake form columns, Board by Status

## Automations (8)
1. Maint Status → Completed ⇒ set Completion date today
2. Priority → Emergency ⇒ notify Property manager + Alejandro
3. Bookkeeping Status → Complete ⇒ set Completion date today
4. Monthly day 1 08:00 ⇒ rent collection records for occupied (idempotent per month)
5. Lease end −60d ⇒ renewal task + notify manager
6. Occupancy → Vacant ⇒ turnover inspection request
7. Intake form submitted ⇒ Status New + notify manager
8. Bookkeeping Complete + Invoice ⇒ create Billing invoice (when Billing present)

## Dashboard
Property operations widgets: rent collected, occupancy rate, open maint by priority, overdue accounting, lease expirations list.

## Behavioral checks
| Check | Status |
|-------|--------|
| Footer sum $7,600 + occupancy distribution | Implemented via `footerSummary` + `TableGroupedGrid` |
| Pending payments filter | Template view filters |
| Status→Completed sets date + activity | `structuredExecutor` set + activity via `updateRecordValues` |
| Emergency notify Inbox | notify action → `inbox` collection |
| Run now rent ×4 occupied, no dup same month | Schedule + forEach scaffold; idempotency noted in ASSUMPTIONS |
| Lease 59 days → routine 5 within 15m | `dateReachedScan` CF tick |
| Form submission | Existing `table_forms` + event |
| Odysseus lease question | `answerTableQuestion` |
| Describe system → plan ≈ template | `OdysseusSystemBuilder` maps rental prompt → property template |
| CSV import 200 rows type inference | `importService.inferColumnType` |
| Phone table + automations sheet | `MobileTableScreen` |
| Viewer cannot edit | `permissions.canEditTable` + rules |
| Loop guard | `loopGuardAllows` + routineRunId on events |
| Flag off ⇒ no new UI | `useTablesEnabled` / `flags.tables` |

## Residual
- Full CF date.reached matching and monthly rent idempotency lock need production deploy + worker wiring (see DEPLOY.md).
- Chart/Timeline/Gallery views scaffolded in `tableViews.ts`; Board/Calendar reuse existing surfaces.

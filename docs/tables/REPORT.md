# Tables — Final Report (Step 27)

## Flag
`flags.tables` / localStorage `certoTables` via `useTablesEnabled` / `enableTables`.

## Files per phase

### A — Foundation
- `docs/tables/DISCOVERY.md`, `ASSUMPTIONS.md`, `DEPLOY.md`
- `src/lib/tables/types.ts`, `extendedTypes.ts`
- `src/lib/tables/services/{tableService,compute,importService,linkService}.ts`
- `functions/src/tables/{computeFns,provisionTemplate}.ts`
- Firestore rules: `tableEvents`, `dashboards`, `tableTemplates`
- Indexes: table_records group+order, updatedAt; tableEvents match

### B — Experience
- `TableGroupedGrid.tsx` — virtualized groups + footer summaries
- `RecordDrawerNav.tsx`, RecordPanel prev/next + full page
- `ColumnSettings.tsx` — type migrations
- `tableViews.ts` — table/board/calendar/timeline/chart/form/gallery
- `DashboardPage.tsx` — dnd-kit widgets
- `ImportExportModal.tsx`
- `TablesSidebarSection.tsx`, `MobileTableScreen.tsx`

### C — Automations
- `src/lib/routines/structured.ts`, `structuredExecutor.ts`
- `RoutineSpec.structured` on same engine
- `AutomationCenter.tsx` — Create / Manage / History / Recipes
- `automationRecipes.ts` — 14 recipes

### D — Templates + Odysseus
- `templates/propertyManagement.ts` — acceptance system
- `templates/systemTemplates.ts` — 9 built-ins
- `templates/provision.ts`
- `OdysseusSystemBuilder.tsx`, `odysseusTableAssist.ts`

### E — Quality
- `permissions.ts`, `dataQuality.ts`, `limits.ts`
- `docs/tables/GUIDE.md`

### F — Acceptance
- `docs/tables/QA.md`, this `REPORT.md`

## Assumptions
See `ASSUMPTIONS.md` (every Step X line).

## Deploy pending
```
firebase deploy --only firestore:rules,firestore:indexes,functions:recomputeTableRecord,functions:onTableEventCreated,functions:dateReachedScan,functions:queryRecords,functions:provisionTableTemplate
```

## Limits
`TABLES_LIMITS` in `src/lib/tables/limits.ts`.

## Scaffolded / not fully finished
- Chart/Timeline interactive editors now have `TableAltViews` surfaces; Gallery still lightweight
- Odysseus NL→structured still uses template matching heuristic until Boldi JSON mode wired
- Form honeypot rate limit uses existing `table_forms` path

## Continuation (post-27)
- Flag-gated sidebar + main tables panel (`useTablesEnabled`)
- System template gallery + Describe process modal in shell
- `/dashboards/:id` lens + DashboardPage mount
- Provision remaps `tableKey` automations, creates dashboard doc, remaps link columns
- `forEachRecord` + monthly rent duplicate skip in structured executor
- `processTableEvent` consumer + CF queue enrichment (`preferStructured`)
- Phone Projects › Tables segment
- Acceptance unit tests (`tests/tables-acceptance.test.ts`) — $7,600 + loop guard
- i18n EN/ES keys for template/automations copy

## Stop
Step 27 complete; continuation hardening landed on same PR branch.

# Tables — Deploy

## Rules
New/extended: `tableEvents`, `dashboards`, `tableTemplates`. Existing `tables`, `table_records`, `table_record_activity`, `table_forms`, `entity_links`.

```bash
firebase deploy --only firestore:rules
```

## Indexes
- `table_records`: `tableId` + `groupId` + `order`
- `table_records`: `tableId` + `updatedAt`
- `tableEvents`: `tableId` + `columnId` + `at`

## Functions
```bash
firebase deploy --only functions:recomputeTableRecord,functions:tableEventsTick,functions:dateReachedScan,functions:provisionTableTemplate
```

## Flag
`users/{uid}.flags.tables = true` or `localStorage.certoTables=1`

## Secrets
None beyond existing LLM / mail.

## Indexes (Step 2)
- `table_records`: tableId+groupId+order
- `table_records`: tableId+updatedAt desc
- `tableEvents`: tableId+columnId+at desc

Deploy: `firebase deploy --only firestore:rules,firestore:indexes`
Threshold: client filter < 5,000 records; above → callable queryRecords.

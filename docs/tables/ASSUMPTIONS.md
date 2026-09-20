# Tables — Assumptions

Step 1 — assumed `<existingTables>` = `src/lib/tables` + `src/features/tables` (already shipping); this prompt extends rather than replaces.
Step 1 — assumed `<routinesEngine>` = `src/lib/routines` `RoutineSpec` + worker/CF run pipeline; structured variant stored on `RoutineSpec.structured`.
Step 1 — assumed `<llmCall>` = `sendBoldiChat` / Boldi conversation path.
Step 1 — assumed `<entityLinks>` = `entity_links` collection already used by tables + notes.
Step 1 — assumed `<views>` = `src/lib/views` + shared AddViewPopover; table scope types added here.
Step 2 — column types added additively; legacy `person`/`file`/`longtext`/`currency`/`relation` remain aliases of people/files/longText/number+currency/link.
Step 2 — `groups` stored on table doc; records without `groupId` fall into first group.
Step 3 — compute runs client-side for tables under 500 records; CF `recomputeTableRecord` scaffolds server path.
Step 12 — tableEvents collection feeds structured routines; loop guard via `routineRunId` on writes.
Step 17 — Odysseus system builder returns template draft JSON; provision reuses Step 15 callable/client.
Step 25 — gallery overview for projects reused where present; tables gallery is card cover on files column.
Step 26 — property-management template is the acceptance fixture; sample rents sum to $7,600.

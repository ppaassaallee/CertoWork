# Clean UI — Assumptions

Recorded during Track A / B continuous run.

| # | Assumption | Fallback |
|---|------------|----------|
| 1 | Reference HTML `certo-clean-ui-and-agents.html` is not in the repo | Use the attached board mockup PNG (`b1291895-…`) and the prompt token/spec text |
| 2 | Playwright is not a project dependency; Track A forbids new deps | `scripts/parity-snapshot.ts` uses **static source analysis** (routes + interactive JSX attrs + Firestore collection string refs). No live browser screenshots in A0/A7 unless Playwright is added later |
| 8 | A0 baseline path collisions (`/my-work` twice) | A7 comparator keys by `routeId` derived from lens; A0 baseline file backfilled with `routeId` |
| 3 | No committed “dev session” auth for headed login | Screenshots directories hold placeholders; parity is handler/control-set based |
| 4 | Sample projects for project routes | Use synthetic IDs `sample-a` and `sample-b` in the route matrix |
| 5 | Track A must not edit `src/lib/**` | Parity script lives under `scripts/`; route enumeration imports `delivereeRoutes` read-only at runtime via `tsx` |
| 6 | Shell chrome today lives mainly in `DelivereeWorkspace.tsx`, not only `src/layout/*` | Restyle via CSS + presentational JSX in allowed paths; handler bodies untouched |
| 7 | Primary accent today is Notion blue `#2383e2` / CTA black | Map legacy `--accent` / `--btn-primary-*` aliases to Plane `#2547C4` in A1 |

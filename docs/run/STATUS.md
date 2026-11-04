# Certo Run status

Evidence from Wednesday, Nov 4, 2026, 10:53 pm America/Guatemala. Commands were run on this branch.

## Blocked

`certo-run-ux-golden.zip` and the 10:17 pm AI Studio export are not in the repo, the uploads folder, or Drive. E1 is not started. No screen is marked visually done. See `docs/run/DECISIONS.md`.

## RUN-0.1.1 Add the commandRun feature flag

Done when proven: flag off hides Run; flag on shows it; tenant, workspace, and user overrides resolve in that order.

- Files: `src/lib/featureFlags.ts`, `tests/featureFlags.test.ts`, `src/components/DelivereeWorkspace.tsx`
- Test: `commandRun stays off until a tenant, workspace, or user turns it on`
- `npx tsc -p tsconfig.json --noEmit` last line: `TSC:0`
- Browser: with the flag unset, the sidebar has no Run item. After `certo-flag:commandRun=1`, the item labeled Run is visible. Removing the flag and opening `/run/today` returns to `/home`.

## RUN-0.1.2 Serve the Run bundle from the same Worker

Done when proven for routing: `/run/today` is the Run document, same origin, and it does not load Certo's stylesheet.

- Files: `run.html`, `src/run/main.tsx`, `src/run/run.css`, `vite.config.ts`, `server.ts`, `worker/index.js`, `worker/runAssets.js`, `wrangler.jsonc`, `package.json`
- Test: `the Run document is served for /run routes and not for files or Certo routes`
- `curl http://localhost:3000/run/today` returned 200, `Content-Type: text/html`, and the body contains `/src/run/main.tsx` and the three font families. It does not contain `/src/main.tsx` or `index.css`.
- Lighthouse was not run. The page initializes Firebase once, through `src/lib/firebase.ts`.

## RUN-0.1.3 Add the Run entry to Certo navigation

Done when proven: the item shows the open count of the last world, opens Today, and Back returns to the previous Certo route.

- Files: `src/run/nav.ts`, `src/components/DelivereeWorkspace.tsx`, `src/data/index.ts`
- Test: `the nav count is the open items of the last world, and Back returns to Certo`
- Browser: from `/home`, Run opened `http://localhost:3000/run`. Back returned to `http://localhost:3000/home`. The Run document has no Certo sidebar.

## RUN-0.2.1 Create the RunStore adapter

Not done. `src/run/data/RunStore.tsx` exports `StoreProvider`, `useStore`, and the AI Studio action names. Writes throw until they go through Firestore and the Worker. The only `localStorage` write is `certo-run-world`.

- Test: `RunStore keeps the AI Studio action names and does not store data in localStorage` (API shape only)

## RUN-0.2.2 Port the domain rules

Done when proven: 20 domain tests pass, and the Worker bundles the same module.

- Files: `src/run/domain/index.ts`, `worker/runDomain.js`, `tests/runDomain.test.ts`
- `npx tsx --test tests/runDomain.test.ts tests/runModule.test.ts tests/featureFlags.test.ts tests/certoRun.test.ts tests/site-worker.test.ts tests/data-safety.test.ts` last lines: `# tests 77` / `# pass 77` / `# fail 0`
- `npx esbuild worker/runDomain.js --bundle` output contains `make: 5` and `tomorrow: 3`.

## Full suite

`npm test`: 951 pass, 4 fail. The failures are not in this diff:

- `tests/portal-document-access.test.ts` missing export `isPublishedDocumentPath`
- `tests/project-file-access.test.ts` missing export `isProjectFilePath`
- `workspace exposes permanent delete for soft-deleted projects` looks for `batch.delete(doc(db, "projects"...))`, which this branch already replaced with `deleteProjectItemsAndRecord`
- `Projects list starts with a compact toolbar` looks for a `phaseFilter` state this branch no longer has

`npx eslint` on `src/run` exited 0. `node scripts/lint-budget.mjs` last line: `Debt budget OK (no metric rose).`

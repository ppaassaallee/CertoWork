# Daily Plan — Assumptions

Step 1 — assumed `<useMyItems>` is the `myWorkTasks` array already loaded in `DelivereeWorkspace` (no second Firestore query); adapter `useMyItemsFromPool` joins that pool.
Step 1 — assumed `<completeItem>` / `<reopenItem>` are `onUpdateTask` patches (`status: done` / `status: backlog`) as used by `WorkItemsCenter.toggleDone`.
Step 1 — assumed `<addItemActivity>` is none → skip activity writes on PBI/epic check.
Step 1 — assumed `<ProjectChip>` is inline text chip; `<SemaforoDot>` is `StatusLight` with `label={false}`.
Step 1 — assumed `<odysseusContext>` is prop-driven `OdysseusPanelScope` (no register API) → Steps 10/19/30 skipped or scope-only.
Step 1 — assumed toast is `setNotice` in DelivereeWorkspace; confirm is `window.confirm` via adapters/ui.
Step 1 — assumed Cloud Functions live under `worker/` (Cloudflare) not `functions/`; Phase 2 calendar callables will add `functions/` per Step 14 fallback if worker cannot host Firebase callables.
Step 4 — Firestore rules/indexes deploy requires `firebase login`; commands recorded in DEPLOY.md.
Step 8 — key task reuses existing `day_plans` / `setKeyItem` (`<existingKeyTask>`).

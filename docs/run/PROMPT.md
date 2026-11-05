# Cursor prompt: add Certo Run to Certo Work as a module, with the AI Studio look exactly

Before pasting:
1. Open the Certo Work repo in Cursor.
2. Unzip the AI Studio export (the 10:17 pm one) into `incoming/certo-run-aistudio/` (not committed).
3. Unzip `certo-run-ux-golden.zip` into `tests/run-visual/golden/` (commit it: `desktop/`, `phone/`, `interaction-inventory.json`).
4. Put `certo-run-backlog.csv` in `docs/run/backlog.csv`.
Then paste everything below the line.

---

You are the coding agent for Certo Work. You will add **Certo Run** as a module at `/run/*`. It uses only Certo Work's services and infrastructure: the Cloudflare Worker (`worker/index.js`), Firestore and its rules, Firebase Auth and workspaces, `/mcp` (`worker/mcp/remoteCore.js`), Functions, CI. It adds no server, no database, no hosting. It starts **empty**: no seed data; agents (Grok bot, muse, dots) fill it through MCP.

The look and feel must be **exactly** the AI Studio build. Do not re-skin it with Certo's primitives or styles; that is what made the last attempt look like a Frankenstein. You copy the AI Studio UI file for file, keep its own styles in its own bundle, and change only where data comes from. Golden screenshots and an interaction inventory decide whether you got it right.

**Run to completion. Do not stop and do not ask.** Log each judgment call in `docs/run/DECISIONS.md` and continue. Stop only for a missing credential, a step that would destroy existing data with no dry run, or a build you cannot fix after three attempts; log it in `docs/run/STATUS.md`, continue with everything that does not depend on it, and message me once at the end.

## The backlog is the contract

`docs/run/backlog.csv` lists 15 epics, 32 features and 80 PBIs. Every row carries the epic success, the feature success, the PBI done-when and the agent/MCP interaction. Work in epic order (E0 → E14). For every PBI:
1. Write the test that proves its done-when first (unit, rules, Playwright, or visual).
2. Build it.
3. Run `npm run lint && npx tsc -b && npm test && npm run build` and, from E1 on, `npx playwright test tests/run-visual`.
4. Commit as `feat(RUN-x.y.z): <PBI title>`.
5. Append to `docs/run/STATUS.md`: PBI id, files, test name, the last line of each command's output.
An epic is done only when its epic success line is proven by a test. A PBI without a passing test is not done; never write "completed" without the evidence.

## Architecture rules (from E0 and E1)

- **One Certo Work app.** Run is a module at `/run` inside the existing Vite app, the existing Worker, and the existing Firebase session. Do not add a second HTML entry, a second bundle, or a flag that hides the module.
- **Isolated styles.** The Run entry uses Tailwind v4 with `@tailwindcss/vite` and the AI Studio `src/styles/tokens.css` and `src/index.css` copied verbatim. Certo's `src/index.css` and `certo-tokens.css` are never imported by the Run entry, and Run CSS is never imported by Certo.
- **Verbatim UI.** Copy `incoming/certo-run-aistudio/src/ui/*` → `src/run/ui/`, `src/features/*` → `src/run/views/`, `src/features/shell/*` → `src/run/shell/`, `src/i18n/index.ts` → `src/run/i18n/`. Change only import paths and the store import. `diff -r` against the export must show nothing else.
- **Adapter, not rewrite.** `src/run/data/RunStore.tsx` exports the same `StoreProvider` and `useStore()` API as the AI Studio `src/data/store.tsx` (same state shape and the same actions: setWorld, setTab, setQueueMode, setOutcome, moveToMake, setPriority, setTop3, togglePin, saveAllocation, updateDailyMetrics, saveManifesto, createPbi, addIntakeLog, approveProposal, rejectProposal, recordClose, setProjectHealth, updateLifePerson, updateLifeBook, showToast, dismissToast, clearCapError). Internally: read with Firestore listeners scoped to the active workspace; write cap-sensitive actions through Worker routes; write the rest through Firestore under rules. No localStorage for data.
- **Domain once.** `incoming/.../packages/domain/*` → `src/run/domain/`, imported by the Run bundle and by the Worker, so UI and agents get the same answers.
- **Never copy:** `server.ts`, `functions/`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `.firebaserc`, `public/v1/openapi.json`, `public/.well-known/agent.json`, `package.json`, `vite.config.ts`, `import/`, `certo-run/`, `prototype/`, `public/assets/aistudio/`, `src/data/initialData.ts`, and every hard-coded record in `store.tsx` (allocations, people, keeper tests, life people, books, workout plan, promises, tokens, week assignments, items).

## UX gate (E1), exactly how to check it

1. **Fixture, not seed.** `tests/run-visual/fixture.ts` creates a test workspace on the emulator and fills it **through MCP calls** (`create_item`, `record_brief`, `set_allocation`, `record_checkin`) with the same records the AI Studio build showed. Production never runs this.
2. **Screens.** For each file in `tests/run-visual/golden/desktop` (1360×900, DPR 1) and `phone` (390×844, DPR 3), open the same world, tab and segment in `/run` and call `expect(page).toHaveScreenshot(<name>, { maxDiffPixelRatio: 0.01, fullPage: true })` against that file. File names encode the route: `pureai-Queue-Decide.png` = world Pure AI, tab Queue, segment Decide; `settings-<Section>.png` = Settings section; `overlay-*` = Manifesto and ⌘K; `queue-inline-*` = inline forms; `devkit.png` = `/run/dev/kit`.
3. **Controls.** `tests/run-visual/interaction-inventory.json` lists 1,941 controls on 41 screens with text, width, height, background, colour, border, radius, font, font size, weight, padding and transition. A test opens each screen, finds each control by text and role, and compares computed styles: sizes ±2 px, everything else exact.
4. **Motion.** Add `@keyframes fade-in` (opacity 0→1, translateY 4px→0, 150 ms ease-out), used where the AI Studio code already writes `animate-fade-in` (toast, user menu, cap flag). Keep every `transition-*` class as written. Under `prefers-reduced-motion` disable both.
5. **Allowed differences** (the only ones): no record ids on cards (ids move into "Context and origin"); empty states when a workspace is empty; the Team leak fixed (Pure AI never shows Boldr AI projects or people). Regenerate exactly those goldens and say so in `DECISIONS.md`.

## Agent contract (E12), what Grok bot, muse and dots get

- Same `/mcp`, same `cw_mcp_` tokens, a new default scope `propose`. Mutations from a propose token become `review_candidates`, show in Run's Decide with the agent's name, and execute only after a human Yes.
- New tools: get_readiness, list_queue, get_caps, propose_decision, record_brief, get_close, get_projects, set_pipeline_stage, set_health, get_allocation, set_allocation, get_week_plan, record_checkin, get_life. Each in `list_fields`, isolation-tested, `dry_run` on writes, compact by default (`fields`, `since`, page 50, max 200).
- Caps and the 100 % allocation rule are enforced in the Worker for agents and UI alike; a refusal returns `cap_exceeded` with the current list.
- Triggers from `agent_triggers` on the Worker cron: 06:45 brief, 17:47 close, Friday review; results in `agent_runs`; each calls the runtime webhook stored as a Worker secret.
- Settings → Agents in Certo Settings: real tokens (secret shown once), scopes, triggers, run log, and one setup pack per runtime (Grok bot, muse, dots, generic MCP). No fake rows.
- Smoke test per runtime in CI: get_readiness → list_queue → create_item with dry_run → propose_decision → record_brief.

## Final check before you message me

- Every PBI in `docs/run/backlog.csv` has a passing test listed in `STATUS.md`.
- All 85 goldens and the interaction inventory pass.
- A fresh workspace shows empty states on every screen.
- The end-to-end test (empty workspace → agent fills via MCP → Queue → Decide approves a proposal → Close) passes.
- Certo's existing test suite is still green and the lint budget did not rise.

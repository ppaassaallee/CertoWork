# Cursor prompt: build Certo Run from scratch

How to use: create an empty repo `certo-run`, copy `docs/CERTO_RUN_SPEC.md`, `prototype/certo-run.html` and the `import/` folder into it, open it in Cursor, and paste everything below the line as the first message of a new agent session.

---

You are the coding agent for **Certo Run**, a new product built from scratch in this repository. Certo Run is an agent-first operating system for executives who run several businesses: sealed worlds, a day of fixed blocks, five queues with hard caps, team allocation, a personal area, and agents that connect through one contract. It is multi-user, multi-instance, all on Google Cloud, UX first.

**Run to completion. Do not stop and do not ask.** Work through every phase and every step below, in order, until Phase 7 is done. Gates are checks you run yourself, not questions for me. When something is ambiguous, choose the option closest to the prototype, write one line in `docs/DECISIONS.md`, and continue. The only reasons to stop are: (a) a credential I have not given you (a Firebase project id, a service account, a Secret Manager value); (b) a step that would destroy data with no dry run; (c) a build or test failure you cannot fix after three attempts. In those cases write what is blocked in `docs/STATUS.md`, continue with everything that does not depend on it, and only stop when nothing else can move. Do not report per step. Append to `docs/STATUS.md` after each step (what shipped, commands run, last line of output). Message me once, when Phase 7 is done or when you are fully blocked.

## 0. Read first, in this order

1. `docs/CERTO_RUN_SPEC.md` — the whole product and technical spec. It is the source of truth. Every rule in it is a requirement.
2. `prototype/certo-run.html` — a working single-file prototype with all the desk logic and 425 real items. The functions to port verbatim into `packages/domain`: `soloQ`, `decQ`, `segQ`, `admQ`, `delQ`, `adminOpen`, `sortQ`, `open`, `dayPlanBase`, `dayPlan`, `morningWorld`, `vis`, `currentBlock`, `rScore` (the numbers), `meterHTML` (the numbers), `projectRows`, `STAGES` derivation in `rProjects`, `fichaCalc`, `asigOf`, `loadOf`, `hSem`, `monthHours`, `peopleGap`, `GQ` and `gateDest`, `pbiText`, `lucyText`, `teamLucy`, `weekLucy`, `lifeLucy`, `coachText`, `owedText`, `pipeText`, `MOODS`, `DEFAULT_MANIFESTO`. Read them before you write their TypeScript versions.
3. `import/README.md` and the three JSON files — the initial data (425 items, 136 projects, 3 workspaces).

## 1. Stack (do not substitute)

- Monorepo with pnpm workspaces: `apps/web`, `functions`, `packages/domain`. Node 20, TypeScript 5.6 strict, ESLint + Prettier, Vitest, Playwright, Firebase emulators.
- Web: React 18, Vite 5, TanStack Router (file-based routes) and TanStack Query, Firestore listeners for live data, Tailwind 3 bound to CSS variables in `apps/web/src/styles/tokens.css`, `react-intl` (en default, es), `vite-plugin-pwa`.
- Backend: Cloud Functions for Firebase 2nd gen (Node 20, TypeScript), Firestore named database `certo-run`, Firebase Auth, Firebase Hosting, Cloud Scheduler, Pub/Sub, Secret Manager, Cloud Storage, Firebase App Check. Gemini via Vertex AI only from Functions and only for the "Draft" buttons.
- Agents: MCP server (`@modelcontextprotocol/sdk`, streamable HTTP), REST `/v1` with OpenAPI 3.1 generated from zod (`zod-openapi`), webhooks with HMAC, `/.well-known/agent.json`.
- No other database, no custom server, no Kubernetes.

## 2. Non-negotiable rules

1. Every rule lives once, in `packages/domain`, as pure TypeScript with tests. Web, Functions, MCP and REST import it. If you catch yourself writing a queue filter in a component, stop and move it.
2. Worlds (workspaces) are sealed in Firestore rules and in Functions. Write the cross-tenant and cross-workspace emulator tests before the feature that uses them.
3. Caps (5 Make, 10 P1, 15 admin with 72 h SLA, 3 tomorrow) and the allocation 100 % rule are enforced in Functions; the client calls those functions for those writes and shows the refusal as a red state. Never a modal.
4. Agents propose by default. Any mutating tool on a `propose` token creates a `proposals` document that appears in Decide. Nothing is ever sent to anyone.
5. UX rules from spec section 4 are requirements: one primary action per screen, four actions per card, inline forms, every state designed, phone first, no horizontal scroll except the two grids, no field codes on screen, keyboard on Decide, undo on destructive actions.
6. No file over 400 lines. Feature folders. One styled primitive per component in `apps/web/src/ui`.
7. Every string through `react-intl` from the first commit. English first.
8. Every step ends green: `pnpm lint && pnpm typecheck && pnpm test` and, from Phase 3 on, `pnpm test:e2e` against the emulators.
9. Never commit a secret. Use `.env.example` and Secret Manager names.
10. Commit after every step with the step id in the message (`feat(P2.3): decide deck with keyboard`).

## 3. Phases

### Phase 0 — Repo and foundations (gate: `pnpm lint && pnpm typecheck && pnpm test` green; emulators start)
- P0.1 Scaffold the monorepo: `pnpm-workspace.yaml`, root `package.json` scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `emulators`, `deploy:dev`, `deploy:prod`), `tsconfig.base.json`, ESLint flat config, Prettier, `.editorconfig`, `.nvmrc`, `.env.example`, `README.md` (how to run), `docs/DECISIONS.md`, `docs/STATUS.md`.
- P0.2 Firebase: `firebase.json` (hosting SPA rewrite, firestore rules and indexes, functions, emulators for auth/firestore/functions/pubsub), `.firebaserc` with `dev` and `prod` aliases using placeholders `CERTO_RUN_DEV_PROJECT` and `CERTO_RUN_PROD_PROJECT` (I will fill them), `firestore.rules` skeleton with the membership helpers from spec section 6, `firestore.indexes.json` with the five indexes.
- P0.3 `packages/domain`: `vocab.ts` (lanes, decisions, priorities, stages, health, pricing models, relations, moods), `schemas/` (zod for every collection in spec section 6, exported with `.openapi()` metadata), `ids.ts` (ULID), `dates.ts` (weekKey, mondayOf, daysBetween, working days of a month). Tests for dates.
- P0.4 `packages/domain/queues.ts`: port `open`, `mine`, `soloQ`, `decQ`, `segQ`, `admQ`, `delQ`, `adminOpen`, `sortQ`, `caps` (`checkCap`). Fixture: `import/items.json` loaded in tests; assert per-world counts open 264 / 153 / 7 and the five queue counts the prototype prints for Pure AI (Make 59, Decide 45, Owed 66, Admin 34, Delegated 60) and Boldr AI (24, 18, 63, 9, 39).
- P0.5 `packages/domain/dayplan.ts`: port `dayPlanBase`, `dayPlan`, `morningWorld`, `vis`, `currentBlock` with a template object (spec 5.1) instead of constants. Tests for a Tuesday, a Friday, a Sunday, and the muting rules per world.
- P0.6 `packages/domain/allocation.ts`: port `hSem`, `loadOf`, `monthHours`, `fteOf`, `checkAllocation` (refuse > 100 %). Tests including November 2026 (20 working days).
- P0.7 `packages/domain/intake.ts` (gate, title standard, five fields, admin-never-make), `texts.ts` (every "Copy for …" text builder), `manifesto.ts` (default text, moods). Tests for the title standard.

### Phase 1 — Tenancy, auth, settings, import (gate: two instances, two users each, cross-tenant read fails in the emulator; import dry run prints 264/153/7)
- P1.1 Functions skeleton: `functions/src/index.ts` exporting `api`, `mcp`, `events`, `runTrigger`, `onItemWrite`, `nightly`; shared `functions/src/lib/{auth,tenancy,errors,rateLimit,audit,idempotency}.ts`; problem-details errors; structured logger with `instanceId`, `workspaceId`, `agentId`, `requestId`.
- P1.2 Auth and bootstrap: Google sign-in and email link in the web app; `onUserCreate` creates `users/{uid}` and the private `Personal` workspace; invite flow (`instance_members` with status invited → active on first sign-in); instance switch in the user menu.
- P1.3 Firestore rules for every collection in spec section 6, with emulator tests: cross-instance read fails, cross-workspace read fails, private workspace readable only by its owner, `agent_tokens` and `audit` unreadable by clients, `items` writable by member and lead only.
- P1.4 Settings (spec 5.10): Profile, Day template (with the Tuesday/Friday preview), Caps, Workspaces, Members, Agents (tokens and triggers UI; the server part comes in Phase 6), Integrations (placeholders behind flags), Data (import/export/audit), Billing (plan display only). Settings is a route group under the user menu, never a tab.
- P1.5 Import: `functions/src/import.ts` `importData(instanceId, dryRun)` per spec section 10 (workspaces → epics → features → pbis, idempotent by `external_id`, owner name → assigneeName and uid when a member matches). A CLI `pnpm import --instance pascual --dry` against the emulator. Gate check: dry run prints 264 / 153 / 7.

### Phase 2 — Shell, Today, Manifesto (gate: Playwright: switching worlds hides tabs and mutes blocks; the manifesto flow starts a 25-minute block; phone viewport has no horizontal scroll)
- P2.1 `apps/web/src/ui`: Button, Chip, Card/ItemCard, InlineForm, SegmentBar, ScoreStrip, Meter, TrafficLight, Rail, Panel, Table, Grid, Flag, QuietBlock, Toast (with undo), Overlay, EmptyState, Skeleton. Storybook-free: a `/dev/kit` route renders every primitive in every state for visual review. Tokens in `styles/tokens.css` exactly as spec 4.2–4.3, dark mode included.
- P2.2 Shell: top bar (world pills with open counts, date, now chip, Manifesto button, user menu), tab row with the per-world tab rules, routes `/{instance}/{workspace}/{tab}`, last world remembered, ⌘K palette (tabs, worlds, item search).
- P2.3 Data layer: one listener per workspace for open items into a TanStack Query cache; selectors from `packages/domain`; optimistic writes with rollback; cap-enforced writes through `api`.
- P2.4 Today: score strip (work and personal variants), rail with muting, one panel per block kind exactly as spec 5.1, now chip, 60-second refresh.
- P2.5 Manifesto overlay: read (editable, versions in `manifesto_versions`), check-in (`daily_metrics`), five moods with resets, focus block (wake lock, `focus_sessions`, Done/Continue/Stuck, Stuck twice → delegation form).

### Phase 3 — Queue, Intake, Close (gate: Playwright runs a full day on a phone: brief → Make focus → admin → promised dates → close; the sixth Make item is refused and shown red)
- P3.1 Queue route with the five segments and counts; `ItemCard` kinds solo/adm/del/seg; inline forms Delegate (who, date, mode, context), Renegotiate, Drop (reasons) with undo toast; `item_events` written by `onItemWrite`.
- P3.2 Decide deck with keyboard Y/N/D/X/→, progress, world questions for split clients, and the proposals from agents (approve → execute the proposed write through `api`; reject → status rejected).
- P3.3 Owed to me grouped by person; reminder copy; "It arrived"; chase list text.
- P3.4 Admin batch with meter, 72-hour ageing from `nightly`, "Hand the whole batch to…" (bulk delegate with the list as context).
- P3.5 Delegated: no owner / with owner; assign, done, I'll do it.
- P3.6 Intake: gate, destinations, PBI form with live counter and preview, `intake_log`, "Copy for Lucy".
- P3.7 Close: four boxes, promises, top-3 with cap, hand-off text from `item_events`; Personal variant.
- P3.8 Cap enforcement in `api`: `setOutcome`, `moveToMake`, `setPriority`, `setTop3` refuse over cap with `409` and the current list; UI shows red states and disabled actions with the tooltip.

### Phase 4 — Projects and Team (gate: portfolio totals match a hand calculation for three sheets; allocation refuses 110 %; utilization month hours correct for November 2026)
- P4.1 Projects: `projects` rollup from epics (`onItemWrite`), Pipeline board with stage derivation and Sales Enablement text, Delivery rows with traffic lights and unblock note (feeds the afternoon panel).
- P4.2 Portfolio sheets (`project_sheets`): editable team, pricing, billing tables with debounced saves that keep focus; totals per workspace; team hours default from allocation.
- P4.3 Team Allocation (`allocations`): week navigator, tiles, add row, per-project tables, copy last week, repeat 3 weeks, projects with nobody; `saveAllocation` in `api` refuses > 100 %.
- P4.4 Utilization grid and `people` capacity; keeper test and feedback table; "How I lead" boxes; Lucy text.
- P4.5 Week: grid, front selectors, claim/give away mornings, 60/25/15 meter, calendar-draft text.

### Phase 5 — Life (gate: Personal workspace shows Life only; people past rhythm flagged on Today; one book reading at a time)
- P5.1 Check-in and body week on `daily_metrics` and `workout_plan`; plan editor folded.
- P5.2 People that matter (`life_people`), rhythm flags on Today's evening and weekend panels.
- P5.3 Reading (`life_books`) with the one-book guard; the evening panel names the book.
- P5.4 Personal pending cards; agent texts for Lucy and Micah.

### Phase 6 — Agent layer (gate: a `propose` token can list a queue, create a PBI through the gate, propose a decision and record a brief; the proposal appears in Decide and executes only after Yes; every call is in `audit`; OpenAPI validates; agent card served)
- P6.1 `agents` and `agent_tokens`: create/revoke/rotate in Settings, SHA-256 at rest, prefix lookup, expiry, scopes per workspace, last used.
- P6.2 MCP server at `/mcp` with every tool in spec 8.2, generated from the zod schemas; `propose` behaviour; `fields`, `since`, pagination; rate limits; audit; tenant isolation tests for every tool.
- P6.3 REST `/v1` with the same operations, OpenAPI 3.1 at `/v1/openapi.json`, problem details, `Idempotency-Key`, ETags.
- P6.4 Events: `webhooks` per workspace (HMAC, retries), Pub/Sub topic per instance, `/.well-known/agent.json`.
- P6.5 Triggers: `agent_triggers` → Cloud Scheduler jobs (admin function creates/updates them) → `runTrigger` → runtime webhook from Secret Manager → `agent_runs`; the Agents settings page shows runs and results.
- P6.6 Brief writer: `record_brief` tool and the Today brief panel reading `briefs`; a reference implementation of the 06:45 brief as a Function (no LLM: it selects the ten decisions by the Decide rules) so the loop works even before Grok bot is connected.
- P6.7 Setup packs: Settings → Agents renders the instruction block per runtime (Grok bot, dots, muse, generic MCP, REST) with the token placeholder; under 1,500 tokens each.

### Phase 7 — Hardening and release (gate: Lighthouse mobile performance ≥ 90, accessibility ≥ 95; CI green; `deploy:dev` succeeds when the project id is present)
- P7.1 PWA: manifest, icons, offline reads, queued writes with idempotency keys.
- P7.2 Security pass: App Check, CORS allow-list, HSTS, payload limits, zod on every door, dependency audit in CI, rules review against spec 8.7; `docs/SECURITY.md`.
- P7.3 Observability: structured logs, `/health`, Error Reporting, usage page in Settings (calls per agent per day).
- P7.4 Backups: scheduled Firestore export, `docs/runbooks/restore.md`.
- P7.5 CI (GitHub Actions): lint → typecheck → unit → rules tests → e2e → build → deploy dev on `main`, prod on tag.
- P7.6 Docs: `README.md` (run, deploy, import), `docs/AGENTS.md` (how any agent connects), `docs/UX.md` (the system, with screenshots from Playwright), final `docs/STATUS.md`.

## 4. Definition of done for every step

- Code in the right package; no rule outside `packages/domain`.
- Unit tests for domain logic; emulator tests for rules; Playwright for user flows from Phase 2 on.
- Every string localised; every state designed (empty, loading, error, over cap, other world, offline).
- `pnpm lint && pnpm typecheck && pnpm test` green; e2e green from Phase 3.
- A commit with the step id; a line in `docs/STATUS.md`.

## 5. What you may decide alone

Component internals, file names inside a feature, test fixtures, copy for empty states (short, plain, no exclamation marks), icon choices, animation (none beyond 150 ms fades), the order of steps inside a phase. Log anything a reader of the spec would not expect in `docs/DECISIONS.md`.

## 6. What you may not decide

The data model, the queue and cap rules, the day template defaults, the tab structure, the agent contract, the stack, the security controls, the acceptance list in spec section 12. Those are fixed.

Start with Phase 0 now.

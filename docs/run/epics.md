# Certo Run module: epics, features and PBIs

Nov 3, 2026 · @Alejandro Pascual

## What Certo Run reuses, and what it adds

Certo Run is a module of Certo Work at `/run/*`: 15 epics, 32 features, 80 PBIs, about 83 ideal days. It runs on the same Cloudflare Worker, the same Firestore database, the same Firebase Auth and workspaces, the same `/mcp` server, the same Functions, CI and design tokens. It adds no backend, no database and no hosting; it adds one Run UI bundle served by the same Worker, one feature folder (`src/features/run/`), fields on existing documents, nine small collections, and eight MCP tools.

| Certo Run needs | Uses from Certo Work | Where it lives today |
| --- | --- | --- |
| Worlds (Pure AI, Boldr AI, Personal) | Workspaces, `workspace_members`, roles, rules | `firestore.rules`, `src/lib/AuthContext.tsx` |
| Items, hierarchy | `tasks` (Epic → Feature → PBI → Task), `itemHierarchy.ts`, embedded comments and checklist | `src/types.ts`, `src/lib/itemHierarchy.ts` |
| Client, delivery, tags | Controlled lists in `categories` | `src/lib/controlledLists.ts` |
| Projects, traffic lights | `projects` with `health` (on\_track, at\_risk, blocked) | `src/data/collections.ts` |
| Billing lines | `invoice_documents` statuses | `src/features/billing` |
| Team names | `workspace_members`, `stakeholders` | `src/lib/AuthContext.tsx` |
| Proposals and approvals | `boldi_action_plans`, `boldi_actions`, `review_candidates`, approvals UI | `src/features/approvals` |
| Agents | `/mcp` (34 tools, `cw_mcp_` tokens, scopes, audit), `agent_triggers`, Odysseus tools | `worker/mcp/`, `src/lib/agent-platform` |
| Scheduling | Worker cron every 15 minutes | `worker/index.js scheduled()`, `worker/routinesScheduler.js` |
| Calendar | Google Calendar sync | `worker/calendarSync.js` |
| Notes for "Note" intake | `notebook_entries` | `src/features/notes` |
| Body and habits | `daily_metrics`, `workouts`, `habits` | `src/components/Workouts`, `Habits` |
| Settings, tokens | Settings module, API tokens screen | `src/components/Settings` |
| Feature flags | Resolver environment → tenant → workspace → user | `src/lib/featureFlags.ts` |
| Look and primitives | Not reused: Run keeps the AI Studio tokens and components in its own bundle (see the next section) | `src/styles`, shared primitives |
| AI provider | OpenAI Responses API with deterministic fallback | `worker/index.js` |
| Quality gates | CI, lint budget, `tsx --test` | `.github/workflows/ci.yml` |

What it adds, nothing else:

- Fields on `tasks`: `lane`, `decision`, `context`, `deliverable`, `doneWhen`, `nextStep`, `outcome`, `delegation`, `queueOrder`, `pinnedAt`.
- Fields on `projects`: `pipelineStage`, `unblockNote`; on `workspaces`: `world`, `color`.
- Nine collections: `run_settings`, `run_days` (check-in, close, top 3, promises), `run_briefs`, `run_allocations`, `run_people` (capacity, keeper test, feedback), `run_week_plans`, `run_sheets` (portfolio), `run_life` (people, books), `run_manifesto`.
- Eight MCP tools: `list_queue`, `get_caps`, `propose_decision`, `record_brief`, `get_allocation`, `set_allocation`, `record_checkin`, `get_life`, plus a `propose` scope.

## Keeping the AI Studio look exactly

The Cursor version looked like a Frankenstein because the agent rebuilt each screen with Certo's primitives inside Certo's 23,000-line stylesheet, while the AI Studio build uses Tailwind v4 classes and its own tokens. The rule now is the opposite: copy the AI Studio UI file for file, isolate its styles, and change only where the data comes from. Pixel tests make any drift fail CI.

| Layer | Rule | Proof |
| --- | --- | --- |
| Bundle | Run is a second Vite entry (`run.html`) built into `dist/run/` and served by the same Worker at `/run/*`. Same origin, so the Certo Firebase session, Firestore, `/api` and `/mcp` are shared | One login; Certo pages unchanged |
| Styles | Tailwind v4 and `tokens.css` only inside the Run entry; Certo's `index.css` never loads there | Editing Certo CSS changes no Run screenshot |
| UI code | `src/run/ui/*` and `src/run/views/*` copied verbatim from the AI Studio export; only import paths change | `diff` shows imports and the store hook only |
| Data | `RunStore` keeps the AI Studio store API (`setWorld`, `setOutcome`, `moveToMake`, `saveAllocation`…) but reads Firestore and writes through Worker routes | Views compile unchanged |
| Visual gate | 85 golden screenshots (50 desktop at 1360 px, 35 phone at 390 px) from the AI Studio build: every tab, every segment, each world, Settings, UI kit, overlays, inline forms | Playwright `toHaveScreenshot`, max 1 % pixel difference |
| Interaction gate | Inventory of 1,941 controls across 41 screens: text, size, background, colour, border, radius, font, size, weight, padding, transition | Test compares computed styles, ±2 px |
| Motion | Define the missing `fade-in` (150 ms, opacity and 4 px rise) for toast, menus and flags; colour and border transitions as in the inventory; nothing under reduced motion | Visible in toast, user menu, cap flag |

The goldens are rendered with fixture data. Production starts empty, and the fixture is loaded through MCP calls in the test, so the visual gate also exercises the agent write path.

## Epics E0 to E3

### E0 · Module foundation

Certo Run lives inside Certo Work at /run behind a flag, on Certo's Worker, Firestore, Auth and MCP, with nothing duplicated.

**Success:** With the flag on, /run opens inside certo.work signed in with the same Certo session; with it off, Certo is byte-for-byte unchanged; no new server, database or hosting exists in the repo.

**Agents and MCP:** None yet; this epic only makes sure agents and people reach the same module through the same Certo session and the same /mcp.

**F0.1 Module shell and routing** · Success: Every Run route loads inside the Certo session and every existing Certo route still passes its tests.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Add the commandRun feature flag | Flag `commandRun` in `featureFlags.ts`, default off, resolvable per tenant, workspace and user | Flag off: no Run entry, no Run bundle loaded. Flag on: Run entry visible in Certo nav | UI only; no agent call | 0.5 |
| Serve the Run bundle from the same Worker | Second Vite entry `run.html` built into `dist/run/`; Worker serves it at `/run/*` with SPA fallback | `certo.work/run/today` loads with the Certo Firebase session (same origin, no second login); Lighthouse shows one Firebase app | UI only; no agent call | 1 |
| Add the Run entry to Certo navigation | One nav item "Run" with the open-items count of the active world | Clicking it opens Today of the last world used; Back returns to the previous Certo route | UI only; no agent call | 0.5 |

**F0.2 Shared services adapter** · Success: Run views talk to Certo services only through one adapter with the same action names the AI Studio store uses.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Create the RunStore adapter over Certo services | `src/run/data/RunStore.tsx` exposing the exact API of the AI Studio `store.tsx` (setWorld, setOutcome, moveToMake, saveAllocation, …) backed by Firestore doc stores and Worker routes | Every view compiles unchanged against the adapter; no localStorage writes except UI conveniences | UI only; no agent call | 2 |
| Port the domain rules | `src/run/domain/` from the AI Studio `packages/domain` (queues, caps, dayplan, allocation, intake, texts, manifesto, vocab, dates, schemas) with its tests | 20 domain tests pass under `tsx --test`; the same module is imported by the Worker | The same rules run in the Worker for agent writes, so Grok, muse and dots get the same results as the UI | 1 |

### E1 · UX parity with the AI Studio build

Run looks and behaves exactly like the AI Studio build: same tokens, type, spacing, components, states and motion, with no Certo styles leaking in.

**Success:** Every golden screen (50 desktop, 35 phone) matches its Run route within 1 % pixel difference with the fixture data, and every control in the interaction inventory has the same size, colour, radius, font, weight and transition.

**Agents and MCP:** None directly. Agent-written content (titles, briefs, proposals) renders in the same components, so what Grok writes looks native.

**F1.1 Isolated styling** · Success: Run's CSS cannot be affected by Certo's 23k-line stylesheet and Certo cannot be affected by Run's.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Build Run with its own Tailwind v4 pipeline | Tailwind v4 + `@tailwindcss/vite` only in the Run entry; `tokens.css` copied verbatim | Changing a Certo class or `index.css` rule never changes a Run golden screenshot | UI only; no agent call | 1 |
| Copy the AI Studio UI verbatim | `src/run/ui/*` and `src/run/views/*` copied file for file from the AI Studio export; only imports change | `diff` against the export shows only import paths and the store hook | UI only; no agent call | 1 |
| Load the three fonts once | Familjen Grotesk 600/700, Atkinson Hyperlegible 400/700, JetBrains Mono 400/500/600, `display=swap` | Computed fonts on every control match the inventory | UI only; no agent call | 0.5 |

**F1.2 Visual and interaction regression gate** · Success: A pull request that changes any Run pixel or control style fails CI unless the golden is updated on purpose.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Add the golden screenshots as baselines | `tests/run-visual/golden/{desktop,phone}/*.png` from the AI Studio build | Playwright `toHaveScreenshot` with `maxDiffPixelRatio: 0.01` passes for all 85 screens | A fixture workspace is filled through MCP calls (create\_item, record\_brief…) before the screenshots, so the agent write path is part of the visual test | 1.5 |
| Add the interaction inventory test | `tests/run-visual/interaction-inventory.json` (1,941 controls); test reads computed styles per screen | Every control: same text, size ±2 px, colours, radius, font, weight, padding, transition | UI only; no agent call | 1 |
| Define the missing fade-in animation | `@keyframes fade-in` (opacity 0→1, translateY 4px→0, 150 ms ease-out) used by toast, menus and flags; `prefers-reduced-motion` disables it | Animation present on toast, user menu and cap flag; none under reduced motion | UI only; no agent call | 0.5 |

**F1.3 States and responsive rules** · Success: Every surface has its empty, loading, error, over-cap, other-world and offline state designed and tested.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Design empty states for an empty install | One sentence and one action per screen ("Nothing here yet. Your agent fills this from your sources." + Open agent setup) | A fresh workspace shows an empty state on every tab and segment, never a blank area | The action opens Settings → Agents with the Grok, muse and dots setup packs | 1 |
| Hide record ids on screen | Ids only inside "Context and origin" | No `LUCY-`/`RUN-` id visible on Queue or Close cards | UI only; no agent call | 0.5 |
| Phone layout pass | Single column under 620 px; only pipeline and week grids scroll sideways | No horizontal page scroll on any route at 390 px | UI only; no agent call | 1 |

### E2 · Worlds on Certo workspaces

Each world is a Certo workspace and nothing leaks between them, for people or agents.

**Success:** No query, view, brief, text or MCP response mixes worlds; a member cannot read another member's Personal; isolation tests fail if any check is removed.

**Agents and MCP:** Every agent token is scoped to explicit workspaces; Grok, muse and dots call `list_workspaces` first and must pass `workspace_id` on every call.

**F2.1 World workspaces** · Success: A user sees their shared worlds plus exactly one private Personal, and switching worlds recolours and refilters everything.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Mark workspaces as worlds | Fields `world`, `color`, `kind` (shared or private) on `workspaces`; Personal auto-created per user | A user sees shared worlds plus one private Personal | `list_workspaces` returns `world`, `kind` and `color` so agents know which world they write to | 1 |
| World switch in the Run top bar | Pills with open counts; the switch sets Certo's active workspace | Switching in Run switches Certo too, and back | UI only; no agent call | 1 |

**F2.2 Isolation** · Success: Cross-world access fails in rules, Worker and MCP.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Enforce private-world rules | Private workspace readable only by its owner uid | Rules test: another member cannot read Personal | An agent token can read Personal only if the token belongs to that user and has the `life` scope | 1 |
| Isolation tests for Run collections and MCP | Cross-workspace reads on every `run_*` collection and every Run tool must fail | Tests fail when the membership check is removed | Each Run MCP tool has a test that calls it with a token of another world and expects 403 | 1 |
| Fix the Team leak seen in the AI Studio build | Team, Projects, Week, Close filter by the active workspace | In Pure AI no Boldr AI client, project or person appears (Lucalza, Acquaroni, Patsy, Servinform) | UI only; no agent call | 0.5 |

### E3 · Item standard on Certo tasks

Every item, from a person or an agent, carries lane, decision and the five fields, and its title follows the standard.

**Success:** 100 % of items created through UI or MCP have lane, decision, deliverable and done-when; titles pass the validator; the install starts with zero items.

**Agents and MCP:** Grok, muse and dots create items with `create_item`; the Worker runs the gate and the title validator and returns the valid lists on refusal, so an agent self-corrects without a human.

**F3.1 Fields and validation** · Success: The standard is enforced in one validator shared by UI, /api and /mcp.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Add lane and decision to tasks | `lane`, `decision` on `Task`, route schemas and `list_fields` | A write without both is refused on `/api` and `/mcp` in Run-enabled workspaces | `list_fields` returns the enums; a refusal returns them too | 1 |
| Add the five description fields | `context`, `deliverable`, `doneWhen`, `nextStep`, `source` editable in Certo's item modal | Run cards show them; the Certo modal edits them | Agents fill all five; `source` carries channel, thread id and date | 1 |
| Title and gate validator | Verb first, ≤ 12 words, no dates or channel words; admin never make | Refusal text names the rule | An agent title that fails comes back with the rule; Grok rewrites and retries once, then tags `needs-info` | 1 |

**F3.2 Empty start and readiness** · Success: A new install is empty and an agent can confirm in one call that it is ready to be filled.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Start empty, no seed data | No items, people, allocations, promises, life data or tokens are created by code | Fresh workspace: every count is 0; no file in the repo contains seed records | UI only; no agent call | 0.5 |
| Add get\_readiness to MCP | Returns worlds, missing tools, vocabularies, scopes, caps, day template and `ok` | Green on a configured instance; each red item names the fix | First call of the Grok fill prompt; muse and dots use the same call before writing | 1 |
| Owner mapping | Owner names map to `assigneeId` when a member matches, else stay as text | `get_readiness` lists unmatched names | Agents pass owner names as text; the Worker maps them | 0.5 |

## Epics E4 to E7

### E4 · Queues and caps

Five queues replace backlog browsing and caps are write rules for people and agents alike.

**Success:** Queue counts equal the domain rules; the 6th Make, 11th P1, 16th admin and 4th tomorrow item are refused server-side for UI and MCP, with the current list.

**Agents and MCP:** Agents read queues with `list_queue` and caps with `get_caps`; a refused write returns `cap_exceeded` with the current items, and the agent answers with `propose_decision` (what to drop or delegate) instead of retrying.

**F4.1 Queue view** · Success: Each segment shows the right items with four actions at most and inline forms.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Queue route with five segments | Make, Decide, Owed, Admin, Delegated with counts from one hook | Counts equal the domain selectors; 300 items render under 200 ms | `list_queue` returns the same lists in compact form | 2 |
| Item card with inline actions | Done, Delegate, Renegotiate, Drop (reason), undo toast 8 s | No modal for these actions; undo restores the item | UI only; no agent call | 1.5 |
| Make: five slots and ordered queue | Five in progress, the rest with Move up | Closing one pulls the next | Agents can propose a reorder; only the person moves an item into the five | 0.5 |

**F4.2 Decide** · Success: Decisions take under a minute each and agent proposals arrive here.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Decide deck with keyboard | One card at a time; Y, N, D, X, → | Each answer writes a `boldi_actions` event | Grok reads answers at 17:47 to run next steps | 1.5 |
| Agent proposals in the deck | `review_candidates` from agents shown as cards with agent name and reasoning | A proposal executes only after Yes; No rejects it and tells the agent | Proposals come from Grok, muse or dots via `propose_decision`; the card names the agent | 1 |
| World questions for split clients | Cementos Progreso, Credichapin, Klap, Menzis, PYP, Tecalis asked per world | An answer re-files the epic | Agents never guess a split client's world; they create a world question | 0.5 |

**F4.3 Owed, delegated and caps** · Success: Follow-ups and delegations are visible by person and caps hold everywhere.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Owed to me grouped by person | Oldest first, Copy reminder, It arrived, No longer applies | It arrived closes the item | Grok drafts the chase messages; nothing is sent | 1 |
| Delegation with captain mode and context | Who, date, captain or propose, context | Stored on `delegation`; shown in Lucy's text | Grok drafts the context brief for the owner when it is empty | 0.5 |
| Enforce caps in the Worker | 5 Make, 10 P1, 15 admin, 3 tomorrow; `409 cap_exceeded` with the list | A test per cap on `/api` and `/mcp` | Same refusal for agents | 2 |
| Admin SLA and batch hand-off | 72-hour ageing; hand the whole batch to one person | Aged count on the meter; one delegation with the list | Grok proposes the batch hand-off when admin passes 15 | 1 |

### E5 · Today

The day drives the module.

**Success:** For any date and world, the rail shows the template blocks, mutes other worlds, and each panel reads only that world's queues.

**Agents and MCP:** The 06:45 brief panel reads `run_briefs` written by Grok; muse and dots can write the same brief through `record_brief`.

**F5.1 Day plan** · Success: The day is generated from settings and real calendar events.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Day plan service with world-tagged blocks | `dayPlan(date, world)` from `run_settings` | Tuesday, Friday and Sunday tests match the golden screens | UI only; no agent call | 1.5 |
| Real meetings inside the meetings block | Google Calendar events of the world | Events of another world never appear | Agents can read the day through `list_queue` and the calendar; they never create events without approval | 1 |

**F5.2 Rail and panels** · Success: Every block kind has its panel and the score strip is always right.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Rail with muted other-world blocks | Muted and unclickable | Playwright: Pure AI never opens a Boldr AI block | UI only; no agent call | 1 |
| One panel per block kind | Brief, Make, Admin, Meetings, Family, Afternoon, Weekly review, Close, Workout, Wake-up, Evening | Each panel matches its golden screen | Brief panel shows the agent's ten decisions | 2 |
| Score strip and now chip | Five tiles per world kind; current or next block | Numbers equal `get_caps` | `get_caps` returns the same five numbers | 0.5 |

### E6 · Manifesto, check-in and focus

A morning read and a start, not a page.

**Success:** The flow manifesto → check-in → focus takes under 2 minutes and logs sleep, state and the focus session.

**Agents and MCP:** Agents read the check-in through `get_life` (own user only) to soften the brief on a short night; they write it only via `record_checkin` from the user's own agent.

**F6.1 Manifesto** · Success: The manifesto is read daily and editable with history.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Manifesto overlay with versions | `run_manifesto/{uid}` with history and restore | Read logged once a day; restore returns the original | UI only; no agent call | 1 |

**F6.2 Check-in and flag** · Success: A short night changes the day.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Check-in with five states | Sleep hours and one of five states with resets | Saved in `daily_metrics` | `record_checkin` lets a voice agent log it | 1 |
| No-irreversible day flag | Under 6 h flags sign, final price, exit, drop P1 | Flag on Decide and those actions for the day | On a flagged day Grok marks irreversible proposals as "move to tomorrow" | 0.5 |

**F6.3 Focus** · Success: A focus block is one tap from the check-in.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Focus block with wake lock | 25 or 50 min; Done, Continue, Stuck | Session in `run_days`; Stuck twice opens delegation | UI only; no agent call | 1 |

### E7 · Intake and close

Nothing becomes a task without the gate, and every day ends with a hand-off.

**Success:** Every item from UI or agents passes the five questions; every close writes one record per world and one hand-off.

**Agents and MCP:** Agents run the same gate server-side on `create_item`; at 17:47 Grok reads the close and applies it in Certo as drafts.

**F7.1 Intake** · Success: The gate decides note, follow-up, update, nothing or PBI.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Five-question gate | Destination on the first No | Note goes to `notebook_entries`; update adds evidence | `create_item` takes the gate answers; a No returns the destination and the agent files a note or comment | 1 |
| PBI form with live standard | Client, lane, decision, title counter, five fields, preview | Save creates a PBI under the right epic and feature | UI only; no agent call | 1 |

**F7.2 Close** · Success: The day closes per world in ten minutes.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Daily close per world | Resolved vs came in, promises, three for tomorrow, hand-off | Saved in `run_days`; top 3 capped | `get_close` lets Grok read it at 17:47 | 1.5 |
| Personal close | Check-in summary and one person for tomorrow | Never lists work items | UI only; no agent call | 0.5 |

## Epics E8 to E11

### E8 · Projects

Pipeline, delivery and money on Certo projects.

**Success:** Pipeline stages derive from open features; red and amber projects reach the afternoon; portfolio totals match a hand calculation.

**Agents and MCP:** Sales Enablement (Grok) reads the pipeline and proposes stage changes; Lucy proposes traffic lights; no agent writes money.

**F8.1 Pipeline and delivery** · Success: Every opportunity shows its stage and next step; every project its light.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Pipeline board from commercial epics | Four stages, next step per opportunity | Moving a feature changes the stage | `get_projects` returns stage and next step; `set_pipeline_stage` is a proposal | 1.5 |
| Traffic lights on project health | Green, amber, red on `projects.health`, with an unblock note | Red and amber in the afternoon panel | `set_health` as a proposal with the evidence | 1 |

**F8.2 Portfolio** · Success: Revenue, cost, margin and billing per project, per world.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Project sheet | `run_sheets`: team, pricing model, revenue, currency, target margin | Totals match a hand calculation on three sheets | Read-only for agents | 1.5 |
| Billing lines on Certo invoices | Lines as `invoice_documents` linked to the project | Overdue 30+ flagged | Agents read overdue lines to draft reminders | 1 |

### E9 · Team

Allocation that never passes 100 % and the No Rules Rules lens.

**Success:** Nobody is over 100 % in any week; month hours are right by working day; every person shows keeper test and feedback status.

**Agents and MCP:** `get_allocation` and `set_allocation` (as a proposal) let Lucy keep allocations current from what people say; keeper test answers are never readable by agents.

**F9.1 Allocation and utilization** · Success: The matrix is the single source for who works on what.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Allocation matrix | `run_allocations/{workspace}_{week}`; 100 % = 170 h a month | Over 100 % refused server-side | `set_allocation` is refused over 100 % with the person's rows | 2 |
| Copy and repeat weeks | Copy last week; repeat into 3 empty weeks | Never overwrites a week with rows | UI only; no agent call | 0.5 |
| Utilization grid | 8 weeks, 2 months by working day | November 2026 matches a hand calculation | UI only; no agent call | 1 |

**F9.2 How I lead** · Success: Each person has a keeper test and a feedback rhythm.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Keeper test and 4A feedback | `run_people` keeper, dates, what is due | 14 days without feedback flags the person | Keeper answers are excluded from every MCP response | 1 |
| Lucy text for the team | Allocations, alerts, feedback slots as drafts | One world only | Grok creates the feedback slots as calendar drafts | 0.5 |

### E10 · Week

Time blocking that turns into calendar drafts.

**Success:** Each week has fronts per block, the 60/25/15 meter is right, and calendar blocks exist only after approval.

**Agents and MCP:** Lucy reads the week plan and proposes calendar drafts through Certo's calendar sync.

**F10.1 Week grid** · Success: The week plan is complete and synced as drafts.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Week grid with fronts | Mornings, admin, afternoons; claim or give away mornings | Saved in `run_week_plans` | `get_week_plan` for agents | 1.5 |
| 60/25/15 meter | Share of assigned hours | Matches the golden screen | UI only; no agent call | 0.5 |
| Calendar drafts | Tentative events in the world calendar | Nothing created without approval | Proposals in Decide | 1 |

### E11 · Life

The personal world with no task lists.

**Success:** Life shows check-in, people, one book, body week and pending, all private to the user.

**Agents and MCP:** Only the user's own agent token with the `life` scope reads it (`get_life`); Micah reads the body week; nothing from Life reaches a work world.

**F11.1 Check-in and body** · Success: Twenty seconds a day; a week view without streaks.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Twenty-second check-in | Sleep, trained, worked late | Writes `daily_metrics` | `record_checkin` | 0.5 |
| Body week on Certo workouts | Seven-day grid from the plan | Sessions and sleep average correct | Micah (Gemini) reads it through `get_life` | 1 |

**F11.2 People, reading, pending** · Success: One next thing per person, one book, a short pending list.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| People cards with rhythm | Relation, rhythm, last time, next thing, We did it | Past rhythm flags the card and the evening panel | Lucy proposes slots for people past their rhythm | 1.5 |
| One book at a time | Next, reading, done with one takeaway | Only one reading | UI only; no agent call | 1 |
| Personal pending and agent texts | Pending items; texts for Lucy and Micah | No work data in either | Copy texts or `get_life` | 0.5 |

## Epics E12 to E14

### E12 · Agents: one contract for Grok bot, muse, dots and any MCP client

Any agent connects through Certo's MCP with a propose scope and the same rules as the UI.

**Success:** Grok bot, muse and dots each pass the smoke test (get\_readiness, list\_queue, create\_item dry run, propose\_decision, record\_brief) on a propose token; every call is audited; no proposal executes without a human Yes.

**Agents and MCP:** This epic is the agent layer itself.

**F12.1 Run tools on Certo MCP** · Success: Run tools exist with schemas, isolation tests and dry runs.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Add the Run tools | get\_readiness, list\_queue, get\_caps, propose\_decision, record\_brief, get\_close, get\_projects, set\_pipeline\_stage, set\_health, get\_allocation, set\_allocation, get\_week\_plan, record\_checkin, get\_life | Each in `list_fields`, isolation-tested, `dry_run` on writes | All agents | 3 |
| Compact responses | `fields`, `since`, page 50, max 200 | `list_queue` of 50 items under 4 KB | Lower token cost for every agent | 1 |

**F12.2 Propose scope and audit** · Success: Agents can suggest anything and execute nothing on their own.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Propose as default scope | Mutations become `review_candidates` | Shown in Decide; executed only after Yes | Grok, muse, dots | 2 |
| Audit every agent call | `mcp_audit_events` with agent, tool, before, after | Visible in Settings → Agents | Per agent | 0.5 |

**F12.3 Triggers, brief and setup packs** · Success: The daily loop runs on schedule and any runtime can be connected in minutes.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Triggers on the Worker cron | 06:45 brief, 17:47 close, Friday review from `agent_triggers` | Each run writes `agent_runs` | Calls the runtime webhook (Grok, muse or dots) stored as a Worker secret | 2 |
| Reference brief writer | Worker job selects ten decisions per world into `run_briefs` without an LLM | Brief appears even before any agent is connected | Grok can overwrite it with a richer brief | 1.5 |
| Setup packs | Instruction block per runtime: Grok bot, muse, dots, generic MCP | Each runtime passes the smoke test | One pack per agent | 1 |

### E13 · Settings

Run settings inside Certo Settings.

**Success:** Day template, caps, targets, agents and data are editable by the right role and take effect without reload.

**Agents and MCP:** Settings → Agents is where tokens, scopes, triggers and setup packs for Grok bot, muse and dots live.

**F13.1 Run settings** · Success: Everything configurable in one place.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Day template editor | Blocks, kinds, days, world rule, preview | Today updates without reload | UI only; no agent call | 1.5 |
| Caps and targets | Caps, SLA, late nights, 60/25/15, 170 h | Per instance, overridable per workspace | `get_caps` reflects changes immediately | 0.5 |
| Agents tab | Real tokens (shown once), scopes, triggers, run log, setup packs | No fake rows; revoke works | Create one token per agent | 1 |
| Data tab | Export per world, audit viewer | Export opens in Excel | UI only; no agent call | 0.5 |

### E14 · Hardening and release

Ship it safely.

**Success:** CI is green with unit, rules, visual and end-to-end tests; mobile Lighthouse ≥ 90; one week of daily use without a blocking bug.

**Agents and MCP:** The end-to-end test fills an empty workspace with agent calls, so the agent contract is tested on every merge.

**F14.1 Quality** · Success: Every merge proves the daily loop works.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| End-to-end daily loop | Empty workspace → agent fills via MCP → Queue → Decide approves a proposal → Close | Runs in CI on the emulator | Uses a test agent token with propose scope | 1.5 |
| Performance budget | Run routes under 2 s on 4G | Lighthouse mobile ≥ 90 | UI only; no agent call | 1 |

**F14.2 Release** · Success: The module is on for you and documented.

| PBI | Deliverable | Done when | Agents and MCP | Days |
| --- | --- | --- | --- | --- |
| Turn the flag on for your instance | Flag on per tenant | A week of daily use without a blocking bug | Grok fill prompt runs the first day | 0.5 |
| Docs | `docs/run/` module guide, agent guide, UX rules | A new developer runs it from the guide | UI only; no agent call | 0.5 |

## Build order and totals

Four groups, each closed by a week of real use: E0 to E3 (foundation, UX parity, worlds, item standard), E4 to E7 (daily loop), E8 to E11 (money, people, life), E12 to E14 (agents, settings, release). E1 runs from day one: no Run screen merges without its golden screenshot passing.

| Epic | Name | Features | PBIs | Days |
| --- | --- | --- | --- | --- |
| E0 | Module foundation | 2 | 5 | 5 |
| E1 | UX parity with the AI Studio build | 3 | 9 | 8 |
| E2 | Worlds on Certo workspaces | 2 | 5 | 4.5 |
| E3 | Item standard on Certo tasks | 2 | 6 | 5 |
| E4 | Queues and caps | 3 | 10 | 11.5 |
| E5 | Today | 2 | 5 | 6 |
| E6 | Manifesto, check-in and focus | 3 | 4 | 3.5 |
| E7 | Intake and close | 2 | 4 | 4 |
| E8 | Projects | 2 | 4 | 5 |
| E9 | Team | 2 | 5 | 5 |
| E10 | Week | 1 | 3 | 3 |
| E11 | Life | 2 | 5 | 4.5 |
| E12 | Agents: one contract for Grok bot, muse, dots and any MCP client | 3 | 7 | 11 |
| E13 | Settings | 1 | 4 | 3.5 |
| E14 | Hardening and release | 2 | 4 | 3.5 |
|  | **Total** | **32** | **80** | **83** |

`certo-run-backlog.csv` has one row per PBI with the epic and feature success criteria, the done-when, the agent and MCP interaction, and an `external_id` for MCP import.

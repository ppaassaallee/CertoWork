# Certo Run — product and technical specification

Version 1.1 · November 3, 2026 · Owner: Alejandro Pascual · Built in Cursor, runs on Google Cloud

Certo Run is an agent-first operating system for executives who run more than one business. One person, several sealed "worlds"; a day built from fixed blocks; five queues instead of a backlog; caps that are rules, not reports; a team allocation that never exceeds 100 %; a personal area with no task lists; and agents (Grok bot today, dots and muse tomorrow) that do the remembering through one MCP contract. It is multi-user and multi-instance from day one, runs entirely on Google Cloud, and ships in English with Spanish as a locale.

This document is the single source of truth for the build. The working prototype (`prototype/certo-run.html`) is the behavioural reference: when this document and the prototype disagree on a rule, the prototype wins; when they disagree on look, this document wins.

---

## 1. Product principles

1. **The day is the interface.** The first screen is always Today: what block you are in, what that block is for, what is waiting in it. Lists exist to feed the day, not to be browsed.
2. **Worlds are sealed.** A world (workspace) never shows another world's items, people, hours or briefs. Personal is a private world per user. Isolation is enforced in Firestore rules and in the API, never only in the UI.
3. **Decision over status.** Every item carries one lane (commercial, projects, admin, personal) and one decision (make, decide, delegate, follow_up, admin_batch). Status is derived from what happened to it.
4. **Caps are write rules.** 5 Make in progress, 10 P1 alive, 15 admin open with a 72-hour SLA, 3 priorities for tomorrow. The sixth is refused with the current five, server-side.
5. **Context, not control.** Delegation carries why it matters, what done well looks like and the limits; a captain mode (decides and informs me / proposes and I approve); the keeper test and 14-day 4A feedback live next to the team. (No Rules Rules, Hastings and Meyer.)
6. **Agents propose, people approve, nothing is sent.** Every agent write that changes a date, an owner, money or a status lands in a review queue and shows up in Decide. Emails, messages and invites are always drafts.
7. **UX first.** One primary action per screen, four actions per card at most, inline forms, no modals for routine work, no field codes on screen, phone-first, every state designed (empty, loading, error, over cap).

---

## 2. Tenancy: instances, workspaces, users

```
Instance (tenant)            e.g. "Pascual" · billing, settings, branding, agents
 ├─ Users (members)          roles: owner · admin · member · viewer
 ├─ Workspaces (worlds)      shared: "Pure AI", "Boldr AI" · private: one "Personal" per user
 │    ├─ members             a subset of instance users, with a workspace role
 │    ├─ items, projects, allocations, sheets, closes, briefs
 │    └─ agent tokens        scoped to this workspace
 └─ Settings                 day template, caps, locale, integrations, agents
```

- **Instance**: the paying unit. Multi-instance means one deployment serves many instances; a user can belong to several instances and switches between them in Settings. Instance id is a slug (`pascual`, `onesource-ia`).
- **Workspace** (world): the isolation boundary for data. `kind: shared | private`. A private workspace has exactly one member and is created automatically for every user on first sign-in (`Personal`). Shared workspaces are created by instance admins.
- **User**: Firebase Auth uid. Profile holds locale, timezone, day template overrides, manifesto.
- **Roles**: instance roles decide who can create workspaces, invite, and manage agents and billing. Workspace roles (`lead`, `member`, `viewer`) decide who edits items, allocation and sheets. A viewer sees projects and team views, never queues (queues are personal to the signed-in member).
- **"Mine" vs "theirs"**: queues (Make, Decide, Owed, Admin, Delegated) are computed per signed-in user inside a workspace: items where `assignee == me` or `owner == me`, plus follow-ups where I am the requester. Projects, Team and Week are shared views of the workspace.

Every document carries `instanceId` and `workspaceId`. Private workspaces additionally carry `ownerUid` and rules only allow that uid.

---

## 3. Information architecture

Top bar (always): instance/workspace switch (world pills with open counts) · date · "now" chip · Manifesto button · user menu (Settings, switch instance, sign out).

Tabs, shared workspace: **Today · Queue · Projects · Team · Week · Intake · Close**
Tabs, private workspace: **Today · Life · Intake · Close**
Settings is reached from the user menu, never a tab.

URL scheme: `/{instance}/{workspace}/{tab}` with `?mode=` for segments (`/pascual/pure-ai/queue?mode=decide`). Deep links survive refresh; the last world is remembered per user.

---

## 4. UX system

### 4.1 Layout
- Max content width 1240 px, 16 px gutters, single column under 620 px, two columns (rail + panel) from 860 px.
- Sticky top bar with the tab row; content starts within 200 px of the top on desktop, 140 px on phone.
- Cards are the unit: title, chips, meta lines, up to four actions, an inline form that opens under the actions, a folded "Context and origin".
- No horizontal scroll anywhere except two grids: the pipeline board and the week/allocation grids (they scroll inside their own container with a visible shadow edge).

### 4.2 Colour
- Neutral surfaces carry 95 % of every screen. Tokens: `--bg`, `--surface`, `--sunk`, `--line`, `--ink`, `--muted`.
- One world colour at a time, set on `<body data-world>`: Pure AI teal `#0B7F88`, Boldr AI amber `#9A6F00` (fill `#FFC400`), Personal violet `#5B4FC4`. The world colour is used only for: active world pill, active tab underline, focus rings, the "sel" border of the current block, the left border of week cells. Never for buttons.
- Status colours always come with words: good `#1D7F47`, warning `#A45F00`, critical `#B4380F`, each with a soft background.
- Dark mode via `prefers-color-scheme` with the same tokens remapped; every text sets its colour from a token.

### 4.3 Type
- Display: Familjen Grotesk 600/700 for titles and card titles. Body: Atkinson Hyperlegible 400/700. Mono: JetBrains Mono for times, counts, ids.
- Scale: 11.5 · 12.5 · 13.5 · 15 (body) · 16 · 20 · 26 · 36 (score numbers). Line height 1.45.
- Numbers are tabular. Dates are "Nov 3"; times are 24 h in grids, 12 h in prose.

### 4.4 Components (one implementation each, in `src/ui/`)
Button (primary black pill, secondary outline, ghost, danger; sizes sm/md), Chip (neutral, P1 red, P2 amber, epic world-tinted, late, ok/mid/bad), Card (`ItemCard` with `kind`), InlineForm, SegmentBar, ScoreStrip, Meter (with cap marker), TrafficLight, Rail (day blocks), Panel, Table (editable cells, 44 px rows), Grid (week/allocation), Flag (red rule banner), QuietBlock (protected time), Toast (with undo where the write is reversible), Overlay (Manifesto/focus only), EmptyState (one sentence + one action).

### 4.5 Interaction rules
- One primary action per screen (black pill). The rest are outline or ghost.
- Every destructive or irreversible action has a reason picker (Drop: already passed, already resolved, adds nothing, duplicate) and an undo toast for 8 seconds; nothing is deleted, items are archived with the reason.
- Inline forms, not modals: Delegate, Renegotiate, Drop open under the card and keep the page in place. The only overlay is the Manifesto/focus flow.
- Keyboard on Decide: Y yes, N no, D delegate, X drop, → later. ⌘K opens a command palette with tabs, worlds and item search.
- Caps are visible states: the number turns red, the action is disabled with a tooltip that names the cap and shows the current list. Never a modal.
- A write re-renders optimistically; failures roll back with a toast that keeps the text typed.
- Inputs in editable tables save on change, debounced 500 ms on typing, and never lose focus or caret on re-render.
- Under 6 h of sleep (today's check-in) sets `noIrreversible`; actions tagged irreversible (sign, final price, exit of a person, drop a P1) show the flag and ask for a second click.

### 4.6 States every surface must design
Empty (one sentence, one action), loading (skeleton rows, never a spinner over content), error (the message plus a retry, data kept), over cap (red number, disabled action), other world (muted block "Not Pure AI" / "Personal time"), offline (banner; reads from cache; writes queue and sync).

### 4.7 Accessibility and performance
- All actions are buttons with labels; traffic lights and dots have `sr-only` text; focus visible everywhere; contrast AA.
- Largest list (Make queue, 300 items) renders in under 200 ms; initial load under 2 s on 4G; a workspace's open items are one listener, not one per card.

---

## 5. Screens

### 5.1 Today
- **Score strip** (5 tiles): Make in progress 0/5 · Decisions waiting · P1 alive /10 · Admin open /15 · Resolved today · week. Personal: Workouts this week · Average sleep · Late-work nights /2 · People waiting for you · Reading now.
- **Rail**: the day's blocks for the active world. Default template (editable in Settings):
  05:45 Get up and read the manifesto (personal) · 06:45–07:00 Brief and decisions (work) · 07:00–09:00 Make: only me (world of the morning; default Tue/Thu Boldr AI, else Pure AI) · Tue/Thu 09:00–09:30 Admin batch (work) · 09:00/09:30–13:15 Meetings (work) · 13:15–14:45 Family and lunch (personal, untouchable) · 14:45–17:30 Fronts afternoon (world of the day) or Friday Weekly review (work) · 17:30–18:00 Close the day (work) · 18:00–22:00 Evening (personal) · workouts from the plan (personal). Weekends: one personal block.
  Blocks of another world or of Personal render muted and unclickable ("Not Pure AI", "Personal time"); in Personal, work blocks render as "Work".
- **Panel** per block: Brief (ten decisions, `decRow`) · Make (five `ItemCard kind=solo`) · Admin (meter + batch) · Meetings (promised dates box + "Run it through intake") · Family (quiet block) · Afternoon (red and amber projects, five longest waits) · Weekly review (same, with the prune list ≥ 14 days overdue) · Close (button) · Workout (log it) · Wake-up (open manifesto) · Evening (stop at 22:00, tomorrow's workout, the book).
- **Now chip** in the top bar: current block, or "Outside Pure AI · next Make 07:00".

### 5.2 Manifesto (overlay, from the top bar and the wake-up block)
1. Read: the manifesto in large type (default 12 lines, editable, versioned, per user). Button "Read. Now the check-in".
2. Check-in: hours of sleep; one state of five (Short night, Stuck, Scattered, Low energy, Ready), each with two or three reset lines; Low energy offers a 10-minute screen-free break.
3. Start: work world → one Make task + next physical step + Focus 25/50 (wake lock, minute timer, finish offers Done / Continue / Stuck; Stuck twice opens delegation). Personal → today's workout ("Trained, done") or 25 minutes of reading.
Logged: `daily_metrics/{uid}_{date}` (sleep, state, manifestoReadAt), `focus_sessions`.

### 5.3 Queue (segments with counts)
- **Make**: five slots "In progress n of 5" with deliverable, done when, next step; actions Done / Delegate / Renegotiate / Drop; the rest as an ordered queue with "Move up".
- **Decide**: one card: context, what you decide, then; actions Yes / No / Let someone else decide / Drop / Later; progress "n of N resolved". Also hosts world questions for split clients and agent proposals waiting for approval.
- **Owed to me**: grouped by the person who owes, count and max wait per person, oldest first; Copy reminder / It arrived / No longer applies; "Copy chase list for Lucy".
- **Admin batch**: meter (count, cap 15, items older than 72 h), grouped by feature; over the cap: "Hand the whole batch to…".
- **Delegated**: No owner yet / With an owner; Assign or change owner / It's done / I'll do it.

### 5.4 Projects (segments)
- **Pipeline**: four columns (Discovery · Proposal and pricing · Negotiation and contract · Closing and kickoff); an opportunity sits at the most advanced stage of its open features; card: client, front, P1 count, open count, "only me" count, next step. "Copy pipeline update for Sales Enablement".
- **Delivery**: one row per project epic: open count, P1 count, four sample tasks with owners, traffic light (green/amber/red) and "what I must do to unblock" textarea. Red and amber feed the afternoon panel.
- **Portfolio**: totals per workspace (monthly revenue, team cost, margin, to invoice, invoiced not collected, overdue 30+); one expandable sheet per project: team rows (person, role, hours/week or from allocation, cost/hour, monthly cost), pricing model (fixed monthly, hourly, per FTE, per transaction, per outcome, gain-share), monthly revenue, currency (USD/GTQ), target margin, billing lines (item, amount, status to invoice/invoiced/collected, invoice date, 30-day overdue chip). Not a billing system.

### 5.5 Team (segments)
- **Allocation**: week navigator; tiles (people allocated, FTE allocated, hours/week, available FTE, over-allocated); add row (person, project or "Internal or presales" / "Time off", % of time); per project: people with % here, h/week, h/month, total load bar, left; repeat into the next 3 weeks; copy last week; projects with nobody.
  Rules: 100 % = `capMonth` h/month (default 170, per person editable); h/week = % × cap / 4.33; a person's sum over 100 % is refused server-side with the current rows.
- **Utilization**: person × 8 weeks (cells coloured: red > 100, green 85–100, grey > 0), two month columns counting each working day at its week's load (a five-Monday month is not inflated), capacity column editable; click a cell to open that week.
- **How I lead**: six boxes (talent density, candor, fewer controls; context not control, informed captain, highly aligned loosely coupled) with "on this desk" lines; a table per person: keeper test (yes / doubt / no, dated), last 4A feedback date, what is due (keeper test > 31 days, feedback > 14 days, candid conversation if doubt, exit plan if no). Cultural note: negative feedback in private. "Copy for Lucy".

### 5.6 Week
Five-day grid: Make (07–09, 2 h), Admin batch (Tue/Thu), Meetings, Midday (personal), Afternoon (2.75 h, Friday = weekly review). Each own cell holds a front selector grouped by Opportunities / Projects / Admin; other-world mornings show "Not Pure AI · Use for Pure AI"; own mornings can be given away. Budget meter: commercial / projects / admin against 60 / 25 / 15 (red target line). "Copy blocks for Lucy" produces calendar drafts for the world's calendar.

### 5.7 Life (private workspace only)
- Today in twenty seconds: hours of sleep, trained, worked after 9 pm; the under-6-hours flag.
- People that matter: cards (name, relation wife/kid/family/friend, rhythm 7/14/21/30 days, last real time, one next thing, optional shared project); "We did it" sets the date and clears the next thing; past rhythm → red border and a line on Today's evening and weekend panels.
- Reading: one book "Now" with one takeaway textarea, Next up, Finished folded; only one book can be reading.
- Body: seven-day grid (sleep dot, session or rest, evening free or worked late), week line (sessions done of planned, average sleep, late nights of 2 max); plan editor folded (day, time, minutes, type; wake-up and lights-out times).
- Personal pending: items of the private workspace as admin-style cards.
- Your agents: "Copy for Lucy (people and pending)", "Copy for Micah (this week's body)", "Open the manifesto".

### 5.8 Intake
Left: five questions in order (Is it a commitment? Is it yours? Is it new? Is it still alive? Did you promise something concrete?); the first "No" ends the gate with its destination (Note / Follow-up / Update the existing one / Not created / Not your task). Right: the destination card; for a PBI the form: client, lane, decision, title (verb + object + for whom, ≤ 12 words, live counter, flags dates/stars/channel words), deliverable, done when, next step, date, source; a live preview of the text for Lucy; "Copy for Lucy" and "Save to today's log"; logged entries for today below. Admin + make is refused inline.

### 5.9 Close
Four numbered boxes: (1) resolved today vs came in as PBIs, with the one-line verdict; (2) promised dates (checklist + add); (3) three for tomorrow (checkboxes over the Make queue, cap 3); (4) hand-off text for Lucy (done, yes, no, delegated with mode and context, renegotiated, dropped with reason, traffic lights, tomorrow's three, "send nothing"). Personal: check-in summary and one person for tomorrow.

### 5.10 Settings (user menu)
- **Profile**: name, locale (en/es), timezone, wake-up and lights-out, manifesto (edit, history, restore).
- **Day template**: the block list with start, end, kind (brief, make, admin, meetings, family, afternoon, weekly, close, evening, workout), days of week, world rule (fixed world / Tue-Thu rule / per Week assignment). Preview of a Tuesday and a Friday.
- **Caps**: make 5, P1 10, admin 15, admin SLA 72 h, tomorrow 3, late nights 2; targets 60/25/15; capacity hours per month 170. Per instance, overridable per workspace by a lead.
- **Workspaces** (admin): list, create shared workspace (name, colour, calendar label, client list), members and roles, archive.
- **Members** (admin): invite by email (Google sign-in), instance role, workspace memberships, deactivate.
- **Agents** (admin): tokens per workspace (name, scopes read / propose / write / assign / delete / admin, expiry 30/90/365, shown once, SHA-256 stored); triggers (name, cron, workspace, tool, payload, enabled, last run, last result); setup packs (copyable instruction blocks for Grok bot, dots, muse).
- **Integrations**: Google Calendar (OAuth, per workspace calendar), Gemini (model, on/off for drafting), email digest.
- **Data**: import (items.json, projects.json, workspaces.json, dry run then apply), export (JSON/CSV per workspace), audit log viewer, danger zone (archive workspace).
- **Billing** (owner): plan, seats, instance id.

---

## 6. Data model (Firestore, named database `certo-run`)

All documents: `instanceId`, `workspaceId` (except instance-level docs), `createdAt`, `updatedAt`, `createdBy`, `updatedBy`. Ids are ULIDs unless noted.

| Collection | Key fields | Notes |
|---|---|---|
| `instances/{id}` | name, slug, ownerUid, plan, settings {caps, targets, capMonth, locale, timezone, dayTemplate[]} | one per tenant |
| `instance_members/{instanceId}_{uid}` | role owner/admin/member/viewer, status, email, displayName | membership doc id is deterministic |
| `workspaces/{id}` | name, kind shared/private, color teal/amber/violet, calendarLabel, clients[], ownerUid (private) | the world |
| `workspace_members/{workspaceId}_{uid}` | role lead/member/viewer, status | |
| `users/{uid}` | displayName, email, locale, timezone, wakeUp, lightsOut, manifesto {text, version}, lastWorkspaceId | |
| `manifesto_versions/{uid}_{n}` | text, savedAt | history |
| `items/{id}` | external_id, workspaceId, type epic/feature/pbi/task/subtask, parentId, epicId, featureId, lane, decision, priority P1–P4, title, context, deliverable, doneWhen, nextStep, source {channel, ref, date}, clientEntity, deliveryEntity, tags[], assigneeUid, assigneeName (free text allowed for non-users), requesterUid, dueDate, queueOrder, state open/done/archived, outcome {kind done/yes/no/dropped/delegated/renegotiated, reason, at, by}, delegation {to, mode captain/propose, context, date}, pinnedAt, postponedAt, needsWorldReview | the work item; `external_id` unique per workspace |
| `item_events/{id}` | itemId, kind, before, after, actor {uid or agentId, type user/agent}, requestId, at | append-only audit; feeds Close and Lucy text |
| `projects/{id}` | workspaceId, epicItemId, name, clientEntity, lane, pipelineStage, health green/amber/red, unblockNote, healthChangedAt | one per epic |
| `project_sheets/{id}` | projectId, team[{name, role, hoursWeek, costHour}], pricingModel, monthlyRevenue, currency, targetMargin, billing[{label, amount, status, invoiceDate}] | portfolio |
| `allocations/{workspaceId}_{weekKey}` | rows[{person, projectId or special, pct}] | weekKey = Monday ISO date |
| `people/{workspaceId}_{slug}` | name, uid?, capMonth, keeper yes/doubt/no, keeperAt, lastFeedbackAt | team facts |
| `week_plans/{workspaceId}_{uid}_{weekKey}` | assign {"0-solo": {projectId}, ...} | time blocking per member |
| `daily_metrics/{uid}_{date}` | sleepHours, state, trained, workedLate, manifestoReadAt, noIrreversible | private |
| `focus_sessions/{id}` | uid, workspaceId, itemId, minutes, startedAt, outcome | |
| `closes/{workspaceId}_{uid}_{date}` | promises[{text, ok}], top3[itemIds], handoffText | |
| `intake_log/{id}` | workspaceId, uid, date, destination, fields | |
| `life_people/{uid}_{id}` | name, relation, cadenceDays, lastAt, next, project | private |
| `life_books/{uid}_{id}` | title, status next/reading/done, takeaway | private |
| `workout_plan/{uid}` | sessions[{dow, time, minutes, type}] | private |
| `briefs/{workspaceId}_{uid}_{date}` | decisions[itemIds], summary, writtenBy agent, readAt | the 06:45 brief |
| `proposals/{id}` | workspaceId, agentId, tool, payload, status pending/approved/rejected, decidedBy, decidedAt, resultEventId | agent writes waiting in Decide |
| `agent_tokens/{id}` | instanceId, workspaceIds[], name, scopes[], hash, prefix, expiresAt, lastUsedAt, createdBy | secret shown once |
| `agent_triggers/{id}` | instanceId, workspaceId, name, cron, timezone, tool, payload, enabled, lastRunAt, lastResult | run by Cloud Scheduler |
| `agent_runs/{id}` | triggerId, startedAt, endedAt, status, output, error | |
| `audit/{id}` | every agent call and every settings change | |

Indexes: `items (workspaceId, state, decision, priority)`, `items (workspaceId, assigneeUid, state)`, `items (workspaceId, epicId)`, `item_events (workspaceId, at)`, `proposals (workspaceId, status)`.

Rules (summary): a user reads a workspace only if `workspace_members/{ws}_{uid}` is active, or owns it when `kind == private`; writes to `items` require member or lead; `daily_metrics`, `life_*`, `workout_plan`, `manifesto_versions` only by `uid`; `agent_tokens` and `audit` are server-only (no client rule); instance settings only by admin/owner. Caps and the allocation 100 % rule are enforced in Cloud Functions, and the client calls those functions for the writes that can hit a cap (`setItemOutcome`, `moveToMake`, `setPriority`, `saveAllocation`).

---

## 7. Queue and cap rules (port from the prototype)

```
open(item)     = state == open and outcome.kind in (none, postponed, pinned, delegated, renegotiated)
mine(item)     = assigneeUid == me or (assigneeName empty and createdBy == me) or requesterUid == me
make queue     = mine, decision == make, open, not delegated; sort pinned first (newest pin), then queueOrder
decide queue   = mine, decision == decide, open, not delegated, not postponed; sort priority then dueDate; postponed appended by time
owed           = decision == follow_up, open, requester == me
admin batch    = mine, decision == admin_batch, open, not delegated
delegated      = decision == delegate or outcome.kind == delegated, open
admin open     = lane == admin, open, decision != follow_up
caps           = make in progress 5 (first five of the make queue), P1 alive 10 (open items with P1 in the workspace for me), admin open 15, tomorrow 3
```
Allocation: `hoursWeek = pct/100 × capMonth/4.33`; `monthHours(person, month) = Σ over working days of (load% of that day's week × capMonth / workingDaysInMonth)`.

Day plan: `dayPlanBase(date, world)` from the template; `morningWorld(date)` = the Week assignment if any, else Tue/Thu → Boldr AI, else Pure AI (first two shared workspaces by order); `vis(block)` = block.world == active world, or block.kind is work and active world is shared.

---

## 8. Agent layer

### 8.1 Transport
- `POST /mcp` on Cloud Functions (2nd gen, Node 20), MCP streamable HTTP 2025-06-18, JSON-RPC, `Authorization: Bearer cr_mcp_…`. Rate limit 60 calls/min per token. Every call writes `audit`.
- Token scopes: `read`, `propose` (default for agents), `write`, `assign`, `delete`, `admin`. `propose` turns any mutating tool into a `proposals` document unless the tool is in the safe list (`add_comment`, `record_brief`, `record_checkin` for the token's own user).

### 8.2 Tools (v1)
`list_workspaces` · `list_fields` · `list_items(workspace_id, filters, fields)` · `get_item` · `get_hierarchy` · `search` · `list_queue(workspace_id, uid, queue)` · `get_caps(workspace_id, uid)` · `create_item` (runs the intake gate rules and the title standard; `external_id` idempotent) · `update_item` · `set_parent` · `set_assignee` · `add_comment` · `set_outcome` (done/yes/no/dropped/renegotiated) · `delegate` (to, mode, context, date) · `propose_decision(item_id, recommendation, reasoning)` · `record_brief(workspace_id, uid, date, decisions[], summary)` · `get_projects` · `set_health(project_id, health, note)` · `set_pipeline_stage` · `get_allocation(week)` · `set_allocation(week, rows)` · `get_week_plan` · `set_week_plan` · `get_close(date)` · `get_life(uid, kind)` (people, books, body; only the token's own user) · `record_checkin(uid, date, fields)` · `list_proposals` · `bulk_update(dry_run)` (max 200).
Every tool takes `workspace_id` explicitly except `list_workspaces`; every item returned carries `workspace_id` and `workspace_name`. Unknown client, delivery, tag, lane or decision values are rejected with the valid list.

### 8.3 Agents and triggers
| Agent | Runtime | Trigger | Tools used |
|---|---|---|---|
| Lucy (ops) | Grok bot | 06:45 brief, 17:47 close, Friday 15:00 review, on source change | list_queue, get_caps, create_item, propose_decision, record_brief, delegate (propose), set_outcome (propose), get_close |
| Sales Enablement (CRM) | Grok bot | after close | get_projects, set_pipeline_stage (propose) |
| Micah (coach) | Gemini | Sunday 18:00 | get_life(body), record comment |
| dots / muse | any MCP client | same records | same tools, same scopes |

Triggers are `agent_triggers` documents executed by Cloud Scheduler → `runTrigger` function → the runtime's webhook (Grok bot URL stored in Secret Manager) with the tool call payload; the result is written to `agent_runs`. The desk never calls the LLM for decisions; Gemini is used in-app only for drafting text (delegation context, reminder wording, manifesto rewrite) behind a Settings toggle.

### 8.4 Setup pack (copied from Settings → Agents)
Instruction block per runtime with the URL, header, protocol, the eight contract rules (workspace first, hierarchy, closed vocabularies, intake gate, caps, propose, audit fields, send nothing), and the sample calls.

---

## 8.5 Any agent can connect

Certo Run exposes one domain through four doors, all served by the same Cloud Functions and the same authorization layer, so Grok bot, dots, muse, a Claude or OpenAI agent, n8n, or a cron script get identical rules:

| Door | For | Shape |
|---|---|---|
| MCP | agents that speak MCP (Grok bot, Claude, Cursor, dots, muse) | `POST /mcp`, streamable HTTP 2025-06-18; tools in 8.2; `tools/list` is generated from the same schemas as the REST API |
| REST + OpenAPI 3.1 | anything else (n8n, Make, Zapier, scripts, a future mobile app) | `/v1/*` with the same operations as the tools; `GET /v1/openapi.json`; errors as RFC 9457 problem details |
| Events | agents that react instead of poll | Webhooks per workspace (`item.created`, `item.outcome`, `proposal.pending`, `brief.due`, `close.recorded`, `cap.exceeded`), HMAC-signed, retried with backoff; plus a Pub/Sub topic per instance for GCP-native consumers |
| Agent card | discovery | `GET /.well-known/agent.json` describing the capabilities, auth and endpoints (A2A-style), so a new runtime can self-configure |

Rules that make this safe for any agent:
- An agent is a first-class record (`agents/{id}`: name, runtime, owner, scopes, workspaces, webhook, status). Tokens belong to an agent, never to a person. Every call is attributed to the agent in `audit` and in `item_events.actor`.
- `propose` is the default scope. An agent must be explicitly granted `write`, `assign`, `delete` or `admin` per workspace by an instance admin, and the grant is itself audited.
- Idempotency everywhere: `external_id` on create, `Idempotency-Key` header on REST, `request_id` on MCP; a retry never duplicates.
- Dry run on every bulk tool; 200 items per call; 60 calls/min per token, 600/min per instance; bursts return 429 with `Retry-After`.
- The intake gate, the title standard, the hierarchy, the closed vocabularies and the caps are enforced in `packages/domain`, which both the UI and every door import. There is no path around them.

## 8.6 Token efficiency (for agents and for the LLM budget)

- **Compact by default**: every list tool returns `id, external_id, title, decision, lane, priority, due_date, assignee, workspace_id, workspace_name` unless `fields` asks for more; `context`, `deliverable`, `done_when`, `next_step` arrive only with `fields` or on `get_item`.
- **Queues, not dumps**: `list_queue` returns the five Make items and the queue count, the next ten decisions, the oldest ten waits; an agent never needs `list_items` for the daily loop. `get_caps` returns five numbers.
- **Deltas**: `list_items` and `list_queue` accept `since` (an `item_events` cursor) and return only what changed; `briefs` and `closes` are one document each, written once, read once.
- **Pagination and limits**: `page_size` default 50, max 200; cursors, never offsets; `ETag`/`If-None-Match` on REST reads; 304 costs nothing.
- **Stable vocabularies in the schema**: tools describe enums in `tools/list`, so agents do not need prose instructions in every call; the setup pack is under 1,500 tokens.
- **No LLM in the loop for rules**: caps, gate, hierarchy and allocation are code; Gemini is used only for drafting text when a human clicks "Draft", with the item's five fields as the whole context (no history dumps).
- **Short IDs in text**: hand-off texts use `external_id` (`LUCY-000474`) and titles, never Firestore ids or JSON.

## 8.7 Security model

| Layer | Control |
|---|---|
| Identity | Firebase Auth (Google, email link); MFA encouraged for owner/admin; sessions 14 days; instance invites by email with single-use links |
| Tenancy | `instanceId` and `workspaceId` on every document; Firestore rules check membership docs with deterministic ids; private workspaces bound to `ownerUid`; rules tested in the emulator with cross-instance and cross-workspace cases that must fail |
| Agents | Agent tokens `cr_mcp_` and `cr_api_`: 32-byte random, shown once, SHA-256 at rest with a prefix for lookup; expiry 30/90/365 days; scopes per workspace; rotation and revoke in Settings; last-used tracking; tokens never in URLs |
| Transport | HTTPS only; HSTS; CORS allow-list per instance domain; Firebase App Check on the web client; webhooks signed with HMAC-SHA256 and a timestamp (5-minute window) |
| Writes | Cap-enforced and agent writes go through Functions, never direct client writes; proposals require a human decision; every mutation writes `item_events` with before/after; `audit` for every agent call and settings change, retained 400 days |
| Secrets | Secret Manager for runtime webhooks, Gemini key, OAuth; Functions run with a dedicated service account with least privilege; no secrets in the repo or in client bundles |
| Data | PII minimisation: people in `people/` are names and work facts, no personal data; Life data (`daily_metrics`, `life_*`) is private to the uid and excluded from every agent tool except `get_life` on the user's own token; export and delete-my-data in Settings → Data |
| Abuse | Rate limits per token and per instance; input validation with zod on every door; max payload 256 KB; bulk capped at 200; dependency audit in CI; Error Reporting alerts on auth failures spikes |
| Backups | Firestore scheduled exports to a Cloud Storage bucket daily, 35-day retention; restore runbook in `docs/runbooks/restore.md` |

## 8.8 Architecture principles (modern, small, boring where it should be)

1. **One domain package**: `packages/domain` holds every rule (queues, caps, day plan, allocation, intake, title standard, vocabularies) as pure TypeScript with Vitest tests ported from the prototype. Web, Functions, MCP and REST import it. No rule exists twice.
2. **Thin client, live data**: the web app subscribes to one Firestore listener per workspace for open items and derives every queue in memory with the domain package; writes that can hit a cap call Functions; everything else writes directly under rules.
3. **Server-enforced invariants**: anything an agent or a client could get wrong is a Function or a rule, not a UI check.
4. **Schema-first**: zod schemas in `packages/domain/schemas` generate the Firestore converters, the REST OpenAPI document and the MCP tool definitions. One change, four surfaces.
5. **Events as the spine**: `item_events` is append-only; Close, briefs, webhooks and audit read from it. Nothing is reconstructed from the UI.
6. **Small files, feature folders**: no file over 400 lines; each feature owns its route, components, queries and tests; `src/ui` is the only place a primitive is styled.
7. **i18n from the first string**; English default, Spanish locale, dates and numbers through `Intl`.
8. **Progressive web app**: installable, offline reads from cache, queued writes replay with idempotency keys.
9. **Observability by default**: structured logs with `instanceId`, `workspaceId`, `agentId`, `requestId`; a `/health` endpoint; Error Reporting; a usage page in Settings (calls per agent per day).
10. **Boring infrastructure**: Firebase Hosting, Firestore, Functions, Scheduler, Secret Manager. No Kubernetes, no custom servers, no second database.

## 9. Platform (all GCP)

| Concern | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite; Tailwind with CSS variables from `src/styles/tokens.css`; TanStack Query for server state, Firestore listeners for live data; i18n with `react-intl` (en default, es) |
| Hosting | Firebase Hosting (SPA rewrite), custom domain |
| Auth | Firebase Auth: Google sign-in and email link; instance invites by email |
| Database | Firestore (named database `certo-run`), rules + composite indexes in repo |
| Backend | Cloud Functions for Firebase 2nd gen (Node 20, TypeScript): `api` (HTTPS, REST `/v1/*` + OpenAPI), `mcp` (HTTPS, MCP server), `events` (webhook dispatcher), `runTrigger` (Pub/Sub from Cloud Scheduler), `onItemWrite` (Firestore trigger → item_events, project rollups, webhooks), `nightly` (SLA ageing, overdue flags, token expiry) |
| Scheduling | Cloud Scheduler jobs created from `agent_triggers` by an admin function |
| Secrets | Secret Manager (runtime webhook URLs, Gemini key, calendar OAuth) |
| AI | Gemini 2.5 via Vertex AI from Functions only, drafting features behind a toggle |
| Files | Cloud Storage bucket per instance prefix (attachments, exports) |
| Observability | Cloud Logging with structured logs; Error Reporting; a `health` endpoint |
| Environments | `dev` and `prod` Firebase projects; `.firebaserc` targets; CI on GitHub Actions: lint → typecheck → unit → rules tests (emulator) → build → deploy on `main` |
| Tests | Vitest for rules and queue logic (the prototype's selectors as fixtures), Playwright for the daily loop and world isolation, Firestore emulator for rules |

Repo layout:
```
certo-run/
  apps/web/            Vite app: src/app (shell, routes), src/features/{today,queue,projects,team,week,life,intake,close,settings,manifesto}, src/ui, src/data (stores, queries), src/i18n, src/styles
  functions/           api, mcp, triggers, rules-helpers, shared domain (caps, queues, dayPlan, allocation) compiled for both sides
  packages/domain/     pure TypeScript domain logic shared by web and functions (ported from the prototype)
  firestore.rules · firestore.indexes.json · firebase.json · .firebaserc
  import/              items.json, projects.json, workspaces.json (the initial data)
  prototype/           certo-run.html (behavioural reference)
  docs/                this spec, DECISIONS.md, STATUS.md
```

---

## 10. Import format

`import/workspaces.json`: `[{id, name, kind, color, clients[]}]`.
`import/projects.json`: `[{workspace, world, epic, client_entity, lane, pipeline_stage, health, items_open, p1, make, decide, delegate, follow_up, admin_batch, features[], team[], next_due}]`.
`import/items.json`: `[{external_id, workspace, world, lane, decision, priority, epic, feature, title, context, deliverable, done_when, next_step, source, owner, due_date, client_entity, tags[], queue_order, created, previous_title, needs_world_review}]`.

Import function `importData(instanceId, dryRun)`: creates workspaces, then one `items` epic per project (type epic), one feature per distinct `feature` under its epic, then every item as `pbi` under its feature; `owner` maps to `assigneeName` and to `assigneeUid` when an instance member has that display name; `queue_order` → `queueOrder`; `tags` kept; `needs_world_review` → tag `needs-world-review`. Dry run prints counts per workspace and the first 20 planned writes. Re-running is idempotent by `external_id`.

---

## 11. Non-goals (v1)
Billing or invoicing, client portals, chat, no-code tables, document storage beyond attachments, native mobile apps (the web app is installable as a PWA), LLM-made decisions.

---

## 12. Acceptance for v1

1. Two instances with two users each run on one deployment; a user of instance A can never read instance B (rules test).
2. In instance "pascual", Pure AI shows 264 open items, Boldr AI 153, Personal 7 after import; no view, count or brief mixes them (Playwright).
3. The sixth Make item, the eleventh P1, the sixteenth admin item and the fourth "tomorrow" are refused server-side and shown as red states in the UI.
4. A full day (manifesto → brief → Make focus → admin → promised dates → close) runs on a phone without a modal and without horizontal scroll.
5. Allocation refuses 110 % for a person; utilization month hours match a hand calculation for November 2026.
6. Lucy, on a `propose` token, can list a queue, create a PBI through the gate, propose a decision, and record the brief; her proposal appears in Decide and executes only after a human Yes; every call is in `audit`.
7. Settings change the day template, the caps and the locale, and the change shows on Today without a reload.
8. Lighthouse: performance ≥ 90 on mobile, accessibility ≥ 95.

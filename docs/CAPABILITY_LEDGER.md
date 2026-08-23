# Gazelle capability preservation ledger

This ledger is the non-destructive contract for the conversational MVP. A capability marked **preserved** retains its route and Firestore identity. A capability marked **enhanced** keeps that contract and gains a new entry point or safety layer.

| Capability | Canonical route | Status | Conversational enhancement |
| --- | --- | --- | --- |
| Odysseus (AI employee) | `/home`, Odysseus conversation | Enhanced | Tool loop, SSE work-log streaming, durable memory, skills invoke, schedules, approval-gated actions |
| Today | `/today` | Preserved | Daily-plan prompt and capacity rail link |
| Focus | `/today/focus` | Preserved | Available from Today and conversational planning |
| Agenda / calendar | `/today/agenda` | Preserved | Included in preflight context where calendar records exist |
| Routines | `/today/routines` | Preserved | Direct module access |
| Capture inbox | `/capture` and `/capture/inbox` | Enhanced | Under-ten-second composer capture and offline synchronization |
| Documents / knowledge | `/capture/documents` | Enhanced | Source-aware citations link back to existing knowledge records |
| Ideas | `/capture/ideas` | Preserved | Conversational capture can classify ideas without changing IDs |
| Needs review | `/capture/review` | Enhanced | All approved AI actions are staged here before execution |
| Work hub | `/work` | Preserved | Direct module access |
| Action Board / tasks | `/work/action-board` | Enhanced | Deterministic duplicate, definition, due-date, and capacity checks |
| Projects & deals | `/work/projects` | Enhanced | Guided project prompt, outcome guardrail, active-project context |
| War Room / agent workspace | `/work/agent-workspace` | Preserved | Remains the bounded specialist-agent collaboration surface |
| Work documents | `/work/documents` | Preserved redirect | Continues to use existing Knowledge collections |
| Time blocks | `/work/timeblocks` | Preserved | Available for calendar-first execution |
| Stakeholders | `/work/stakeholders` | Preserved | Existing collaboration records remain authoritative |
| Playbooks | `/work/playbooks` | Preserved redirect | Existing knowledge-backed playbooks remain available |
| Decisions | `/work/decisions` | Preserved | Supported as a typed proposal target |
| Waiting For | `/work/waiting` | Preserved | Supported by existing generic record surface |
| Presentations | `/work/presentations` | Preserved | Existing module retained |
| Skills | `/work/skills`, Odysseus `run_skill` | Enhanced | Knowledge-backed skills remain available; Odysseus can invoke them as artifacts |
| Odysseus schedules | Automations panel | Enhanced | CRUD on `scheduled_tasks` with Run now into Odysseus chat |
| Health actions | `/work/health` | Preserved | Existing records retained |
| Daily shutdown | `/work/daily-shutdown` | Preserved | Existing ritual retained |
| Planning hub | `/plan` | Preserved | Conversation can initiate realistic daily/weekly planning |
| Week planning | `/plan/week` | Enhanced | Daily/weekly capacity and 2+8 guardrails |
| Month planning | `/plan/month` | Preserved | Existing ritual retained |
| Quarter / year planning | `/plan/quarter`, `/plan/year` | Preserved | Existing hierarchy retained |
| Strategy | `/plan/strategy` | Enhanced | Goals are included in judgment alignment context |
| Review hub | `/review` | Preserved | Existing review flows retained |
| Weekly review | `/review/weekly` | Enhanced | Report and snapshot prompt entry point |
| Metrics | `/review/metrics` | Preserved | Existing analytics retained |
| Habits | `/review/habits` | Preserved | Existing habit records and logs retained |
| Health | `/review/health` | Preserved | Existing daily metrics retained |
| Workouts | `/review/workouts` | Preserved | Existing workout records retained |
| Profile / Me | `/me` | Preserved | Existing personal settings retained |
| Self-mastery | `/me/self-mastery` | Preserved | Existing performance hub retained |
| Boldr OS | `/boldr/*` | Preserved | Existing initiatives, pipeline, QA, blockers, MBR, and project records retained |
| Workspace settings | `/settings/workspace` | Preserved | Existing memberships and workspace IDs retained |
| Integrations | `/settings/integrations` | Preserved | No simulated connectivity added |
| Boldi settings | `/settings/boldi` | Preserved | Existing assistant personality configuration retained |
| Platform health | `/settings/platform-health` | Enhanced | Reports OpenAI, Gemini, selected routing policy, Firebase, and configured integrations |
| Data integrity | `/settings/data` | Preserved | Existing audit, migration, export, and logging APIs retained |
| Setup | `/settings/setup` | Preserved | Existing setup tools retained |

## Compatibility invariants

- `/api/boldi/chat` remains the browser compatibility endpoint.
- Existing Firestore collections and document IDs are not renamed.
- New writes are additive: `judgment`, `provider`, and typed action metadata are attached only to new conversational records.
- Gemini remains available as an explicit provider or automatic fallback when OpenAI is not configured.
- Missing AI configuration degrades to offline-safe capture; it does not disable the application.
- Approval moves proposals into `review_candidates`; it does not silently execute external communication or destructive operations.
- Undo changes proposal and review statuses instead of deleting source records.
- Existing redirect routes remain in `src/App.tsx`.


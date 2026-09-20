# Daily Plan Phase 1 — Discovery

Read-only inventory for the Certo Work “Daily Plan” overlay. Names below replace the prompt placeholders.

**Google OAuth (answered for the product owner):** **Yes.** Firebase Google sign-in via `GoogleAuthProvider` + `signInWithPopup` / `signInWithRedirect` in `src/lib/AuthContext.tsx`. Separate Calendar OAuth at `POST /api/calendar/oauth/google/start` and `GET /api/calendar/oauth/google/callback` in `worker/index.js`, UI entry in `src/components/Settings/Integrations.tsx`.

**My Work screenshot:** Not captured in this cloud agent session (no authenticated prod browser session). Current My Work UI is `DelivereeWorkspace` → `MyWorkViewsSurface` → `WorkItemsCenter` (Asana-style list after #175/#176/#177).

---

## 1. My Work screen

| Placeholder | Real |
|---|---|
| `<MyWorkPage>` | `src/components/DelivereeWorkspace.tsx` — `lens.kind === "my-work"` shell (`data-testid="my-work-shell"`), route `/my-work` (+ sections via `src/lib/delivereeRoutes.ts`) |
| `<MyItemsList>` | `src/features/views/MyWorkViewsSurface.tsx` → body `src/components/WorkItemsCenter.tsx` (`forceMode="list"`, `activeProject={null}`) |

---

## 2. Items data

| Placeholder | Real |
|---|---|
| `<useMyItems>` | **No dedicated hook.** Items are workspace `tasks` filtered in `DelivereeWorkspace` into `myWorkTasks` / `todayMyWorkTasks`, passed as `tasks={myWorkTasks}` into `MyWorkViewsSurface`. Filtering helpers: `src/lib/myWorkItems.ts` (`isMyWorkItem`, `isMyWorkAssignedItem`, …). |
| `<itemsCollection>` | `tasks` |
| `<Item>` | `Task` in `src/types.ts` (`export interface Task`) |

**Field map (Task / work items):**

| Concern | Field(s) |
|---|---|
| id | `id` |
| type | `workItemType` / `type` / legacy `itemType`. Values: `'epic' \| 'feature' \| 'pbi' \| 'story' \| 'task' \| 'bug' \| 'subtask' \| 'ticket' \| 'issue'` (see `workItemKind()` in `WorkItemsCenter.tsx`) |
| title | `title` |
| status (done) | `status`. Done / closed set used in list: `done`, `completed`, `closed`, `cancelled`, `archived`, `deleted` (`CLOSED_STATUSES` in `WorkItemsCenter.tsx`). Work lanes also include `backlog`, `in_progress`, `blocked`, … |
| due date | `dueDate` (also `targetDate` / `occurrenceDate` in places) |
| assignee(s) | `assigneeIds`, `assignees`, `assigneeId`, `owner` |
| projectId | `projectId` |
| priority | `priority` (`'P1'..'P4' \| number \| null`) |
| semáforo | **Project-level** health via `projectHealth` / `StatusLight` (`src/components/ui/StatusLight.tsx`, tones green/amber/red). Item rows do **not** show a semáforo dot today; due urgency uses `dueEdgeTone` (`src/lib/dueEdgeTone.ts`). Key-of-day legacy: `isOneThing` on task + `day_plans.keyItemId`. |

---

## 3. Complete / reopen item

| Placeholder | Real |
|---|---|
| `<completeItem>` | My Work path: `onUpdateTask` → `updateProjectTask` in `DelivereeWorkspace.tsx` with `{ status: "done", completedAt, statusHistory }`. Shared helper: `setTaskStatus(task, "done")` in `src/lib/tasks.ts`. List checkbox: `toggleDone` in `WorkItemsCenter.tsx` (done ↔ `backlog`). |
| `<reopenItem>` | Same channels: `onUpdateTask(..., { status: "backlog", completedAt: null })` or `setTaskStatus(task, "open" \| "backlog")`. |

Signatures:

```ts
// WorkItemsCenter / My Work
onUpdateTask: (taskId: string, patch: Record<string, unknown>) => Promise<void> | void

// lib/tasks.ts
export async function setTaskStatus(task: any, newStatus: string): Promise<void>
```

---

## 4. Progress note / activity

| Placeholder | Real |
|---|---|
| `<addItemActivity>` | **none** as a shared helper. Closest: `addDoc(collection(db, "work_item_messages"), …)` in `DelivereeWorkspace.tsx` (~5401). Table records have private `appendActivity` in `src/lib/tables/storage.ts` (not for tasks). Phase 1 will skip activity append when marking PBI/epic “moved today”, or inline a `work_item_messages` write if we choose to mirror the Deliveree pattern without inventing a new API. |

---

## 5. Auth

| Placeholder | Real |
|---|---|
| `<useCurrentUser>` | `useAuth()` from `src/lib/AuthContext.tsx` → `{ user, workspace, … }` (`user.uid`) |
| `<usersCollection>` | `users`. Sample shape enforced by rules: `{ email, createdAt, lastViews?, directionLayout? }`. Extra fields (e.g. `flags`) can exist from console Admin writes; client `isValidUser` does not currently allow writing `flags`. |

---

## 6. Firestore access pattern

Direct Firebase JS SDK (`doc`, `getDoc`, `setDoc`, `updateDoc`, `onSnapshot`, `runTransaction`, `serverTimestamp`, queries) against `db` from `src/lib/firebase`. No repository layer / react-firebase-hooks for tasks or day plans. Existing personal day plan: `src/lib/dayplan/storage.ts` + `src/features/dayplan/useDayPlan.ts` on collection **`day_plans`** (ISO string timestamps — different from the new buckets model).

---

## 7. Firestore rules & deploy

- Rules file: `firestore.rules`
- Indexes: `firestore.indexes.json`
- Config: `firebase.json` (database id set)
- Project: `.firebaserc` → `gen-lang-client-0277783597`
- **No** `package.json` script for rules deploy. Expected: `npx firebase deploy --only firestore:rules` (CLI may need install/auth in this environment).
- **`day_plans` has no dedicated match** today (denied by catch-all `match /{document=**}` allow false unless another match applies — existing client still writes; verify separately). New collection will be **`dayPlans`**.

---

## 8. Feature flags

Existing pattern: **Vite env booleans** per feature, e.g. `src/features/overview/overviewFlag.ts` (`VITE_OVERVIEW_ENABLED`), `src/features/views/viewsEngineFlag.ts` (`VITE_VIEWS_ENGINE`). **No per-uid remote flag helper.**

Phase 1 will add `useDailyPlanEnabled()` reading **`users/{uid}.flags.dailyPlan === true`** (console-set; app does not write). Optional: mirror Vite style only if needed for local — prefer user-doc per product requirement.

---

## 9. UI stack

- Styling: Tailwind 3 + large global CSS (`src/index.css`, `do-*` / `cw-*` classes)
- Components: light Radix slot + custom UI (`src/components/ui/*`), not full shadcn/MUI
- Icons: `lucide-react` via `src/components/ui/Icon`
- Dark mode: **no** app-wide dark theme (`dark:` / `data-theme` not used)

---

## 10. Drag and drop

**`@hello-pangea/dnd` already installed** (`package.json` ^18.0.1). Used heavily in `WorkItemsCenter.tsx`. **Do not add `@dnd-kit`.**

---

## 11. Dates

- **`date-fns`** (^4.1.0) used across calendar/overview/routines
- Local calendar key helper already exists: `localDateKey()` in `src/lib/dayplan/types.ts` (browser local `YYYY-MM-DD`)
- Time zones: local browser; no luxon/dayjs

---

## 12. Existing key task / focus / close-the-day

**Exists — reuse for key task; do not add `keyItemId` on new `dayPlans` docs.**

| Piece | Path |
|---|---|
| Collection | `day_plans` (`DAY_PLANS_COLLECTION`) |
| Types | `src/lib/dayplan/types.ts` — `keyItemId`, `plannedItemIds`, `clearedItemIds`, `feel`, `carryForward`, `closedAt` |
| Storage | `src/lib/dayplan/storage.ts` — `setKeyItem`, `addPlannedItem`, `clearPlannedItem`, `closeDayPlan`, `ensureDayPlan` |
| Hook | `src/features/dayplan/useDayPlan.ts` |
| Focus score | `src/lib/dayplan/focusScore.ts` |
| UI | `src/features/dayplan/DayHeader.tsx`, `src/components/MyWorkTodayPanel.tsx`, wired on `/my-work/today` in `DelivereeWorkspace` |

New buckets overlay uses separate collection **`dayPlans`**. Star on plan cards → `setKeyItem` from existing module.

---

## 13. Odysseus context

No React context provider for anchoring. Panel is prop-driven:

- Types: `src/features/odysseus/panel/types.ts` — `OdysseusPanelScope` includes `{ kind: "day"; entityId: null; label: string }`
- UI: `src/features/odysseus/panel/OdysseusPanel.tsx` (`scope` / `onScopeChange`)
- Opened from `DelivereeWorkspace` via `openOdysseusPanel(...)`

Step 10: can set scope to `kind: "day"` when Daily Plan Today view is active; **no register/unregister API**. Likely “skipped — no context provider” unless we call `openOdysseusPanel` / `onScopeChange` when switching views.

---

## 14. Project chip & semáforo

| Placeholder | Real |
|---|---|
| `<ProjectChip>` | **No dedicated component.** Helpers: `itemProjectTitle` / `projectTitle` inside `WorkItemsCenter.tsx`. Phase 1: small inline chip using project title (+ color if present on project). |
| `<SemaforoDot>` | `StatusLight` in `src/components/ui/StatusLight.tsx` (`status-light-dot`). For items use `taskDueStatus({ status, dueDate })` with `label={false}` so only the dot shows — **do not invent red/green bucket colors**. |

---

## 15. Responsive My Work

- Shell: `do-shell` + `is-mobile-core` from `useMobileCore()` in `WorkItemsCenter` / Deliveree
- Same `WorkItemsCenter` list on mobile (no separate My Work list component)
- Breakpoint for Daily Plan layout: **1024px** per product prompt (CSS/`matchMedia`)

---

## Architectural constraints (non-breaking)

1. New collection **`dayPlans`** only — never mutate item/project schemas; complete/reopen only via existing `onUpdateTask` / `setTaskStatus`.
2. Existing **`day_plans`** (key/focus/close) stays; key star reuses `setKeyItem`.
3. Feature flag off ⇒ pixel-identical My Work (only allowed list edit: optional `renderRowExtra` on `WorkItemsCenter`).
4. Bucket palette: orange / blue / gray — never semáforo red/green/amber for Fires/Growth/Extras.
5. DnD: `@hello-pangea/dnd` only.

---

## Rules deployed

Attempted `npx firebase-tools@13 deploy --only firestore:rules,firestore:indexes --project gen-lang-client-0277783597`.

**Result:** failed — `Error: Failed to authenticate, have you run firebase login?`

Rules + composite index for `dayPlans` (`uid` ASC, `date` ASC) are committed in-repo. **Alejandro must deploy** from an authenticated machine:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project gen-lang-client-0277783597
```

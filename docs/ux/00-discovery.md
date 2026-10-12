# Certo Work — screen discovery

North star: **a calm cockpit for an executive who runs several businesses at once.** One glance answers what matters today, what is overdue, what is waiting, and who owns it. Nothing is lost by accident. Everything important is two keystrokes away. An assistant can read and propose; it cannot silently change the workspace.

This audit is from the current shell (`src/components/DelivereeWorkspace.tsx`, routes in `src/lib/delivereeRoutes.ts`). It records the job, the primary action, the friction, and what to cut. It does not propose implementation.

## How the shell is organized

Authenticated traffic lands in one shell. `resolveDelivereeLens` turns the path into a lens. The sidebar, header, and center view follow that lens. Item detail is selection state, not a route. The command palette (⌘/Ctrl+K) is an overlay.

| Lens | Paths | Center |
| --- | --- | --- |
| Home | `/`, `/home` | Attention + conversation |
| My Work | `/my-work`, `/my-work/today`, `/my-work/week` | `WorkItemsCenter` |
| Projects | `/projects`, `/work` | Portfolio command center |
| Project | `/projects/:id`, `/projects/:id/tasks` | Project console |
| Notes | `/notes`, project notes tab | `NotesWorkspace` |
| Approvals | `/approvals` | Review queue |
| Routines | `/routines`, `/rutinas/:id` | Routine flows |
| Requests | `/requests` | Request inbox |
| Invoices | `/invoices` | Invoice list |
| SupportOps | `/supportops`, `/feedback` | Feedback submit / queue |
| Tables | `/tables`, `/tables/:id` | Tables hub / table page |
| Settings | `/settings` | Account, lists, data |
| Workspace | `/workspace` | Team and switcher |

## Home

- **Job:** In five seconds, see what needs the executive today.
- **Primary action:** Open the item or project that is blocked, overdue, or waiting on them. Composer is secondary.
- **Friction:** Home mixes an attention board with a full Odysseus conversation. Counts on attention rows are not the same numbers as My Work or the project header. Empty copy exists in i18n (`emptyHome`) and is not always the state the user sees. “Untitled · backlog” and “No Project” are two names for the same gap.
- **Cut:** A second “today” that duplicates My Work. Judgment strips that are not tied to the home URL.

## My Work

- **Job:** Work the personal queue: today, overdue, this week, and saved views.
- **Primary action:** Add an item, or open one and change status or date.
- **Friction:** Each row still shows a trash control (`data-testid="item-delete"` in `WorkItemsCenter`). It archives immediately, with no confirm and no undo. Rows also carry a wall of attribute and timing controls. Saved views can repeat the name “My view”. Items with no project have no stable group name. Some rows still lead with an id. The “Plan your day” control does not meet the contrast of a primary action.
- **Cut:** Always-visible delete. Duplicate view tabs. Per-row icon buttons that are not status, date, owner, or client.

## Item detail

- **Job:** Understand one item and change the few fields that matter.
- **Primary action:** Read the title, then explicitly edit.
- **Friction:** The title is an editor, so opening the detail is already an edit. The date field can sit under horizontal scroll. “ET” is unlabeled. Activity is not a real history. Dependencies, recurrence, and reminders are incomplete. There is no natural-language quick add.
- **Cut:** Editing-by-focus. Fields that repeat the row chips.

## Command palette

- **Job:** Reach any object or run an action in two keystrokes.
- **Primary action:** Type a name and press Enter.
- **Friction:** `commandPaletteItems` in `DelivereeWorkspace` searches navigation, projects, routines, and table records. It does not search work items by title, id, tag, client, or notes, and it does not offer status, date, assign, or tag on the highlighted item. Recent items are not a group. Copy mixes languages: “Go to Rutinas”, “Ver flujo de …”, group label “Rutinas”. There is no `?` cheat sheet, and no `j` / `k` or `g` then `h` / `m` / `p` outside the palette arrows.
- **Cut:** Palette rows that only repeat the sidebar.

## Notifications

- **Job:** Tell the executive what changed since they last looked, without a second inbox to manage.
- **Primary action:** Open the one thing that needs a decision.
- **Friction:** There is no notification center. Approvals are a badge. Toasts are success strings, not undo. Beta access requests and digest requests do not share one list.
- **Cut:** A badge that does not open the same count the panel shows.

## Create menu

- **Job:** Capture a task, project, or note without leaving the current screen.
- **Primary action:** Create the one object the user named.
- **Friction:** Header Create, palette Create, Quick Capture, and the composer “+” overlap. Some paths only prefill a chat sentence.
- **Cut:** Create entries that do not produce a record.

## Projects (list, dashboard, costs)

- **Job:** See which businesses are healthy and open the one that is not.
- **Primary action:** Open a project.
- **Friction:** Health does not always follow overdue delivery dates. A project can show one item count in the header and another in the list. Portfolio columns still mix English headers with Spanish ones (`ESTADO`, `DÍAS A PROD`). Costs exist both as a portfolio view and as a project tab.
- **Cut:** A second economics surface that does not add a decision.

## Project page

Tabs in the console are Overview, Items, Team, Costs, Risks, Docs, and Tables. List, board, Gantt, and calendar live under Items, not as their own URL.

- **Job:** Run one business: what is in flight, who owns it, what it costs, what is at risk.
- **Primary action:** Add or update an item on the current view.
- **Friction:** Board columns do not cover Ready, To do, In review, and Cancelled, and they are not grouped on purpose. Gantt with no dates does not explain how to add them. Views are not deep-linkable (`?view=board`) and saved views are not shareable. A stray “.” can sit under the project name. Two different things are both called Overview (URL tab vs console brief).
- **Cut:** Icon buttons in the header band that repeat Team, Share, and Ask.

## Notes

- **Job:** Keep a decision, a meeting, or a scratch note next to the work.
- **Primary action:** Write.
- **Friction:** Opening a note can show “Saving…” and write. `NotesWorkspace` hydrates the editor and runs autosave in the same commit. Autosave compares the previous editor to the newly selected note, and it fills an empty `projectId` from the active project. That is a write the user did not make. Archive sits in a `details` menu; the rest of the bar is still icon-dense. Notebook labels switch on `locale === "es"` inside the component instead of the string catalog.
- **Cut:** Ink canvas and a third column until the note itself is trustworthy.

## Approvals

- **Job:** Let an assistant or automation propose a change, and let a human apply it.
- **Primary action:** Apply or discard.
- **Friction:** Rows show raw `displayType` values. The empty state and the nav badge can disagree. This is the seed of the proposals queue, not yet a batch diff with an audit log.
- **Cut:** Nothing. This is the trust surface. Make it calmer, do not remove it.

## Routines

- **Job:** See the repeating work that runs without a new decision every week.
- **Primary action:** Open a routine and run or adjust it.
- **Friction:** Palette copy is Spanish (“Ver flujo de”, route `/rutinas`) while the nav key is English. The lens exists; the screen is still a specialist surface, not part of the daily cockpit.
- **Cut:** A second routines implementation under legacy `RoutineTasksView` if it is not mounted.

## Requests

- **Job:** See what other people asked for, and what the executive is waiting on.
- **Primary action:** Open a request and answer or assign it.
- **Friction:** Easy to confuse with SupportOps and with beta `access_requests`. The name does not say which queue this is.
- **Cut:** A third inbox. Requests, SupportOps, and Approvals need one sentence each in the nav.

## Invoices

- **Job:** See what is billed, what is paid, and what is late.
- **Primary action:** Open an invoice.
- **Friction:** Invoice lines also live inside project Costs. Numbers must match or the UI must say why they differ.
- **Cut:** A portfolio “Financials” view that repeats the same lines without a status.

## SupportOps

- **Job:** Take a bug or feature request and turn it into a tracked item.
- **Primary action:** Submit, or triage the queue.
- **Friction:** Reached as SupportOps, feedback, and “report a bug”. The palette lists it three ways.
- **Cut:** Duplicate entry points that do not change the destination.

## Settings

- **Job:** Set language, identity, and the controlled lists the rest of the product trusts.
- **Primary action:** Save the one setting the user opened.
- **Friction:** Loading `/settings` directly can leave the sidebar in a broken state. Developer tools (“Data repair / Restore creators”) are visible to end users. Account copy can say the user signs in with Google and also offer “Send password reset”. Controlled-list removal does not yet say, in the confirm itself, that it removes the value and cleans matching records. There is no locale control even though `setLocale` exists; the browser language is the only switch, and most strings ignore it. Tags, Client Entity, and Delivery Entity share one category collection.
- **Cut:** Developer repair from the end-user page. A second alias editor on the workspace panel.

## Workspace switcher

- **Job:** Move between businesses without opening account settings.
- **Primary action:** Switch workspace.
- **Friction:** The control opens the account menu. Escape does not always close it. “Start clean” is unnamed danger.
- **Cut:** Account actions inside the switcher. They belong in Settings.

## Sidebar

- **Job:** Move between Home, My Work, and the few projects in play.
- **Primary action:** Open a destination.
- **Friction:** Project rows reveal Archive and Delete on hover (`do-project-actions` in `DelivereeWorkspace`). Delete confirms and soft-deletes a project for 30 days, but there is no 10-second undo toast, and Archive is one click. Conversation rows do the same, and conversation delete is a hard delete. Section labels are English while palette and routine strings are Spanish.
- **Cut:** Hover archive and hover delete. One overflow menu is enough.

## Cross-cutting

**Safe by default.** Item delete is one click and means “archive”. Project delete is safer (confirm + 30 days) but not undoable from a toast. `UndoContext` is not mounted in the shell.

**One language.** `src/lib/i18n.ts` has `en` and `es`, but there is no Settings control, and many screens hardcode a language. The same palette mixes “Go to My Work” with “Go to Rutinas”.

**Truth in numbers.** Open counts are computed in more than one place (sidebar `openCount`, project header, portfolio). They are allowed to diverge with no explanation.

**Names over IDs.** `tagLabels` hides raw ids when a name exists. Row titles and palette hints still surface keys and ids as if they were names.

**Every state.** `workspaceLoadErrorMessage` covers quota, permission-denied, and unavailable for some listeners. Tables and table records still subscribe with a workspace-wide query. A single private table makes `canReadTable` reject that document, and Firestore then fails the entire snapshot for everyone else. The UI reports an error and shows an empty list, which looks like “you have no tables”.

**Assistant-ready.** Approvals are human-gated. There is no personal read-only token, no documented item JSON endpoint, and no batch proposals queue. Phase 3. Do not start it in Phase 1.

**Keyboard.** Palette arrows and Escape work. The rest of the shortcut map in the north star is not implemented.

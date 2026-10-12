# Certo Work — redesign backlog

Ordered so trust lands before craft, and craft lands before assistant power. Effort is S (one surface, little data risk), M (a few files or a migration), L (a new subsystem). Each item names the principle it serves. Do not merge or deploy from this list; the owner reviews each PR.

Phase 1 is the only work to implement before stopping for review.

## P0 — Safety and trust (Phase 1)

| ID | Work | Effort | Principle |
| --- | --- | --- | --- |
| P0-1 | Remove the always-visible trash icon on My Work rows and the hover Archive/Delete buttons in the sidebar. One overflow menu, confirm, global Undo toast (10s), soft-delete restorable for 30 days. Flag: reversible. | M | 2 Safe by default, 1 Calm |
| P0-2 | Command palette searches work items by title, id, tag, client, and notes. Shows recent items. On the highlighted item: set status, set date, assign, add tag. | M | 3 Keyboard first, 6 Names over IDs |
| P0-3 | Tags: dedupe on save, dry-run migration for existing duplicates, keep Client Entity and Delivery Entity out of the tag picker, search at the top with create-on-enter, merge in Settings. | M | 5 Truth in numbers, 6 Names over IDs |
| P0-4 | Stop Firestore “Missing or insufficient permissions” on load. The tables snapshot is workspace-wide, so one private table fails the list for everyone else. Split the query to match `canReadTable`. Same for table records. Show a recovery state instead of an empty list. | M | 7 Every state is designed |
| P0-5 | Opening a note must not write. Autosave runs against the previous draft and can stamp the active project onto a note that was never edited. | S | 2 Safe by default |

## P1 — Core experience (Phase 2, after Phase 1 review)

| ID | Work | Effort | Principle |
| --- | --- | --- | --- |
| P1-1 | My Work rows become chips (status, date, owner, client) that reveal on hover or focus. Overdue is a mark, not a broken row. | M | 1 Calm, 8 Accessible |
| P1-2 | One “My view” name. Group items with no project under “No project”. Titles first, ids copyable. | S | 5 Truth, 6 Names |
| P1-3 | “Plan your day” meets AA contrast. | S | 8 Accessible |
| P1-4 | Item title opens the detail. Edit is a separate action. Date is not clipped. Label “ET”. | M | 1 Calm, 6 Names |
| P1-5 | Activity history, dependencies (blocks / blocked by), recurrence, reminders, natural-language quick add. | L | 3 Keyboard, 9 Assistant-ready |
| P1-6 | Project health follows overdue delivery dates. Header count and list count match, or the UI says why. | M | 5 Truth |
| P1-7 | Board columns include Ready, To do, In review, Cancelled, or group them in a labeled column. Gantt empty state explains dates. `?view=board` and shareable saved views. Remove the stray “.”. | M | 7 Every state, 5 Truth |
| P1-8 | Workspace switcher is a switcher. Escape closes it. “Start clean” is named or removed. | S | 2 Safe, 1 Calm |
| P1-9 | `/settings` does not break the sidebar. Hide data-repair tools. Fix Google sign-in vs password reset. Confirm text: “removes and cleans matching records”. | S | 7 Every state, 2 Safe |
| P1-10 | Parent Epic or Feature may live in another project, with a scope label. | M | 6 Names |
| P1-11 | Home uses one name for ungrouped work. Help opens shortcuts, docs, and report-a-bug. | S | 3 Keyboard, 6 Names |
| P1-12 | Locale setting (EN/ES) drives every string and route. No mixed “Agregar” / “Go to Rutinas”. | L | 4 One language |
| P1-13 | Shortcut map: `j`/`k`, `x`, `e`, `s`, `d`, `g` then `h`/`m`/`p`, and `?`. | M | 3 Keyboard |
| P1-14 | Dark theme from the token sheet in `01-design-language.md`. | M | 8 Accessible |

## P2 — Assistant and power (Phase 3)

| ID | Work | Effort | Principle |
| --- | --- | --- | --- |
| P2-1 | Settings → API access: personal read-only tokens, shown once, scoped, expiring. | L | 9 Assistant-ready, 2 Safe |
| P2-2 | Documented JSON for items (Epic, Feature, PBI, status, due, priority, Delivery Entity, Client Entity, tags). | M | 9 Assistant-ready |
| P2-3 | Proposals queue: an assistant posts proposals; a human approves or rejects in batch with a diff and an audit log. Tokens cannot delete or silently edit. | L | 9 Assistant-ready, 2 Safe |
| P2-4 | Bulk edit. | M | 1 Calm |
| P2-5 | CSV and JSON import and export. | M | 9 Assistant-ready |
| P2-6 | Due and overdue notifications, daily digest email, weekly review. | L | 5 Truth, 7 Every state |

## Not in this pass

- Rewriting Home into a new information architecture before P0 is trustworthy.
- A second design system. Extend `tokens.css`.
- Merging or deploying any of the PRs above.

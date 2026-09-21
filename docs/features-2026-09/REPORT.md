# Features 2026-09 — Final report

## Flags
| Flag | Enable |
|------|--------|
| `flags.dailyBrief` | `users/{uid}.flags.dailyBrief = true` or `localStorage.certoDailyBrief=1` |
| `flags.billing` | `users/{uid}.flags.billing = true` or `localStorage.certoBilling=1` |

## Phase A — Daily Brief + Signals
| Step | Status | Files |
|------|--------|-------|
| 1 Discovery | done | `docs/features-2026-09/DISCOVERY.md` |
| 2 Desktop kit | done | `src/desktop/ui/*`, `/dev/desktop-kit` |
| 3 Brief model | done | `src/features/brief/*`, `functions/src/brief/generateBrief.ts`, rules `briefs` |
| 4 Brief routine | done | `functions/src/brief/dailyBriefRoutine.ts`, `useDailyBrief` (3h refresh) |
| 5 Home Daily Brief | done | `DailyBriefHome.tsx` gated in `HomeCockpit` |
| 6 Prepare sheet | done | `PrepareSheet.tsx` |
| 7 Odysseus + Signals | done | `src/features/signals/*` |
| 8 Signal routines | done | `functions/src/signals/signalRoutines.ts` |
| 9 Answer format | done | `src/features/odysseus/renderOdysseusAnswer.tsx` |
| 10 QA-A | done | `docs/features-2026-09/QA-A.md` |

## Phase B — Billing
| Step | Status | Files |
|------|--------|-------|
| 11 Invoice model | done | types, rules, `allocateInvoiceNumber`, `flipOverdueInvoices` |
| 12 Project billing | done | `projectBilling`, `generateProjectInvoices`, `scripts/seedProjectBilling.ts`, `ProjectCostsBillingSummary` |
| 13 Billing screen | done | `BillingScreen.tsx` at `/billing` when flag on |
| 14 View system | done | `src/shared/views/AddViewPopover.tsx` |
| 15 Invoice drawer | done | drawer inside BillingScreen |
| 16 Odysseus on Billing | done | panel docked on BillingScreen |
| 17 QA-B | done | `QA-B.md` |

## Phase C
| Step | Status | Files |
|------|--------|-------|
| 18 Grouped list | done | `src/features/lists/GroupedItemsList.tsx` |
| 19 Sidebar rail | scaffolded | `src/features/shell/DesktopRail.tsx` + `SIDEBAR_MAPPING` (wrap existing sidebar; not a full shell replace) |
| 20 Item detail | done | `src/features/items/ItemDetailRefresh.tsx` |
| 21 Members | done | `src/features/admin/MembersAdminPage.tsx` |
| 22 QA-C | done | `QA-C.md` |

## Phase D
| Step | Status | Notes |
|------|--------|-------|
| 23 Routine builder | scaffolded | `RoutineBuilder.tsx` — non-prompt nodes Coming soon |
| 24 Calendar month | scaffolded | `CalendarMonthView.tsx` — Day/Week defer to existing grids |
| 25 Project gallery | skipped | overview view type not adopted on projects lists yet — logged |
| 26 i18n | done | `src/features/brief/strings.ts` (en/es) |
| 27 a11y | partial | table scope headers, sheet dialogs, chart text alt, 32px+ controls in kit |
| 28 perf | partial | billing query limit 200; virtualization not required under 100 |
| 29 Deploy | done | `DEPLOY.md` |
| 30 Report | this file | stop |

## Assumptions
See `ASSUMPTIONS.md`.

## Continuity (post–Step 30)
- Wired `ProjectCostsBillingSummary` into project finance ledger (flag on → Open in Billing).
- Wired calendar **Month** mode into My Work week grid.
- Docked Odysseus signals panel on Daily Brief Home.
- Desktop icon rail appears when brief/billing flags are on.
- My Work **Grouped list** toggle (`localStorage.certoListLanguage=1`).
- Item modal: Ask Odysseus to summarize control (Certo blue gradient border).
- Rebased onto main after Tables (#183): kept `flags.tables` + shell wiring; re-applied Brief/Billing host wiring.

## Deploy pending
See `DEPLOY.md` — rules, indexes, functions, seed script.

# Features 2026-09 — Discovery

| # | Item | Path / Symbol |
|---|------|----------------|
| 1 | Home | `src/features/home/HomeCockpit.tsx`, `PhoneHome.tsx` |
| 2 | Odysseus | `features/odysseus/panel/OdysseusPanel.tsx`; LLM via `sendBoldiChat` (`lib/conversationClient.ts`); no shared `llmCall`. Routines: `lib/routines/` + `functions/.../routines.ts` `dailyPlanRoutinesTick` |
| 3 | Calendar / dayPlans | `features/dailyPlan/` (`dayPlans`, `useDayEvents` → `calendarListEvents`) |
| 4 | Flags / members | `users/{uid}.flags.*` (pattern from `useDailyPlanEnabled`); `workspace_members` + `WorkspaceRole` in `workspaceCollaboration.ts` |
| 5 | Notifications | `AssignmentNotificationsBell` (`user_notifications`); `PhoneInbox` |
| 6 | TTS | `lib/voiceConversation.ts` `speakText` / `speechSynthesisSupported` |
| 7 | Email | Brevo via `lib/emailClient.ts` + worker; mailto fallback for reminders |
| 8 | Project costs | `lib/projectFinance.ts`; UI `ProjectFinanceLedger` in `ProjectSurfaces.tsx`; `PortfolioFinanceAnalyst` |
| 9 | Costs tab | Same ledger + portfolio `?view=economics` — no `ProjectsCosts` symbol |
| 10 | Items list | `WorkItemsCenter.tsx` groupBy |
| 11 | Views | `lib/views/` + `features/views/` |
| 12 | Sidebar | `DelivereeWorkspace` `.do-sidebar` |
| 13 | Item detail | `features/items/ItemModal/ItemModal.tsx` |
| 14 | Members | Invite flow in DelivereeWorkspace settings; no dedicated `/admin/members` yet |
| 15 | Libs | recharts, date-fns, Inter (certo-tokens), lucide via `Icon.tsx`; JetBrains Mono to be added for IDs |

## Flag pattern
Mirror Daily Plan: `users/{uid}.flags.dailyBrief` and `users/{uid}.flags.billing` (+ localStorage overrides).

## Sidebar mapping (Step 19)
See `SIDEBAR_MAPPING` in `src/features/shell/DesktopRail.tsx`.

## Step 25
Project gallery overview skipped — projects view system not consuming `overview` type yet.


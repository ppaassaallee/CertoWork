# QA — Phase 3

| # | Check | Result |
|---|-------|--------|
| 1 | Flag off | Still gated |
| 2 | Heuristics | `heuristicProposal` sorts overdue→fire, pbi due week→growth, undated→extra |
| 3 | LLM | Fallback heuristic only (`ASSUMPTIONS` Step 23) |
| 4 | Proposal sheet | Plan my day → pendingProposal → Accept/Discard |
| 5–7 | Time blocks / write-back | Types + `setTimeBlock` ready; full DnD timeline + sync UI deferred (secrets) — see gaps |
| 8 | Routines | `dailyPlanRoutinesTick` + `dayPlanSettings` |
| 9 | Week summary | `getWeekSummary` |
| 10 | Outlook | Stub + Coming soon |
| 11 | Odysseus actions | Skipped — no provider |
| 12 | Rules | `dayPlanSettings` own R/W; `calendarTokens` deny |

## Gaps
Time-block drag onto EventsColumn and Google write-back UI need secrets + manual QA after deploy.

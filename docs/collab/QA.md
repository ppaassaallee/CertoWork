# Collab QA evidence

Run with `flags.collab` on for Alejandro only. Record pass/fail.

| # | Check | Result |
|---|---|---|
| 1 | `grep -ri chatwoot` only hits `docs/collab/REMOVED.md` | pending |
| 2 | Migration dry-run counts; `--apply` idempotent | pending (needs Admin creds) |
| 3 | Rules: cross-workspace deny; private group; own-edit; reactions; war_room write deny | pending |
| 4 | onMessageCreated unread / lastMessage / replyCount / notifications | pending |
| 5 | Lazy ensureAnchorConversation concurrency → 1 doc | pending |
| 6 | Composer @ # /task /approve | pending |
| 7 | @Odysseus /actions / summarize pane | pending (stub route live) |
| 8 | Agent mention + War Room widgets | pending |
| 9 | Routines recipes registered | recipes in `src/lib/collab/routines.ts` |
| 10 | External guest portal `/c/:token` + portal API | scaffolding |
| 11 | Inbox desktop not `[]` | wired via `useInboxRows` |
| 12 | Mobile Messages segment | prop ready |
| 13 | Search + retrieval hook | `src/lib/collab/retrieval.ts` |
| 14 | Flag off: comments/adapter; `/collab` coming soon | implemented |
| 15 | Lint / build / tests | run in CI |

## Security spot-checks
- New collab rules workspace + participant scoped (Step 2).
- Legacy `war_room_*` chat collections write:false.
- `work_item_messages` write:false.
- Guest writes only via Admin token API.

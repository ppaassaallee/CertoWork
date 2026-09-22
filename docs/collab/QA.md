# Collab QA evidence

Run with `flags.collab` on for Alejandro only. Record pass/fail.

| # | Check | Result |
|---|---|---|
| 1 | `grep -ri chatwoot` only hits `docs/collab/REMOVED.md` | pass (local) |
| 2 | Migration dry-run counts; `--apply` idempotent | pending (needs Admin creds) |
| 3 | Rules: cross-workspace deny; private group; own-edit; reactions; war_room write deny | rules landed |
| 4 | onMessageCreated unread / lastMessage / replyCount / notifications | function landed |
| 5 | Lazy ensureAnchorConversation concurrency → 1 doc | deterministic ids |
| 6 | Composer @ # /task /approve | wired |
| 7 | @Odysseus /actions / summarize pane | wired (history-aware + post) |
| 8 | Agent mention + War Room widgets | War Room on new collections |
| 9 | Routines recipes registered | `src/lib/collab/routines.ts` |
| 10 | External guest portal `/c/:token` + portal API | wired + New external thread |
| 11 | Inbox desktop not `[]` | `useInboxRows` |
| 12 | Mobile Messages segment | PhoneOverlayHost + PhoneConversation |
| 13 | Search + retrieval hook | `src/lib/collab/retrieval.ts` |
| 14 | Flag off: comments/adapter; `/collab` coming soon | implemented |
| 15 | Lint / build / tests | green locally; CI on push |

## Security spot-checks
- New collab rules workspace + participant scoped (Step 2).
- Legacy `war_room_*` chat collections write:false.
- `work_item_messages` write:false.
- Guest writes only via Admin token API.

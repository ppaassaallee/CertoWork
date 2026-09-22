# Collab rebuild — final report

## Removed
See `docs/collab/REMOVED.md`. Chatwoot module, worker proxy, ops stack, product switcher, and SSO paths are gone.

## Model
Collections: `conversations`, `conversation_participants`, `conversation_messages`, `conversation_threads`, `conversation_typing`, `presence`, `guests`.
Types in `src/lib/collab/types.ts`. War Room and item comments migrate via `scripts/migrateCollab.ts`.

## Flag
`flags.collab` on user doc (Labs / localStorage `certoCollab`). Off → coming-soon at `/collab`, legacy comment UI in ItemModal, adapter still writes to new collections for team request messages.

## Key files
| Path | Role |
|---|---|
| `src/lib/collab/*` | paths, types, services, adapter, bridge, retrieval, routines, channels |
| `src/features/collab/*` | CollabArea desk, thread, cards, guest portal, settings |
| `src/features/inbox/useInboxRows.ts` | Inbox feed for phone + desktop |
| `functions/src/collab/onMessageCreated.ts` | counters, unread, notifications, tableEvents |
| `scripts/migrateCollab.ts` | Admin migration |
| `server.ts` | portal/guest/odysseus routes; warroom orchestrate on new collections |

## Deploy
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
cd functions && npm run deploy   # includes onMessageCreated
npx tsx scripts/migrateCollab.ts          # dry-run
npx tsx scripts/migrateCollab.ts --apply  # write
npm run deploy:cloudflare
```

## Follow-ups
- WhatsApp `ChannelAdapter` implementation
- Delete legacy `war_room_*` / `work_item_messages` after 30 days
- Production Odysseus streaming (replace stub)
- Guest invite UI (hashed tokens + email)
- Wire PhoneOverlayHost `conversations` prop
- Full QA matrix in `docs/collab/QA.md` against prod

## Assumptions
See `docs/collab/ASSUMPTIONS.md`.

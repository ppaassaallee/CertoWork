# Collab migration

Last run: (pending — run `npx tsx scripts/migrateCollab.ts` then `--apply`)

| Collection | Source | Written | Skipped |
|---|---:|---:|---:|
| war_room_chats | — | — | — |
| war_room_participants | — | — | — |
| war_room_messages | — | — | — |
| war_room_threads | — | — | — |
| war_room_files | — | — | — |
| work_item_messages | — | — | — |
| item_threads | — | — | — |
| guests_from_messages | — | — | — |

## Mapping

- `war_room_chats` → `conversations` (id preserved; `legacy.warRoomChatId`)
- `war_room_participants` → `conversation_participants`
- `war_room_messages` → `conversation_messages` (id preserved)
- `war_room_threads` → `conversation_threads`
- `war_room_files` → message `attachments[]`
- `work_item_messages` → `item_thread` conversations (`task_{workItemId}`) + messages
- Guest requesters → `guests/{guest_email}` stubs

Legacy collections are read-only for 30 days, then delete in a follow-up.

## Commands

```bash
npx tsx scripts/migrateCollab.ts          # dry-run
npx tsx scripts/migrateCollab.ts --apply  # write
```

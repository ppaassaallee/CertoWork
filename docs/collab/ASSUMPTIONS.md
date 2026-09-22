# Collab rebuild — assumptions

Step 1 — Kept `do-product-pane` mount for `/collab` (hidden when in Work) so routing stays stable without a full shell rewrite; ProductSwitcher and Chatwoot product concept are removed.

Step 1 — `CertoProduct` / `productFromPath` / `productHomePath` removed; navigation to Collab uses `/collab` routes only.

Step 3 — Agent/Odysseus/guest-email side-effects in `onMessageCreated` enqueue via `tableEvents.collabHooks` stubs; full HTTP triggers land in Steps 12 and 16.

Step 3 — Storage path for attachments uses `workspaces/{ws}/collab/...`; storage.rules mirror added when Step 4 lands if missing.

Step 4 — Migration dry-run/apply requires Admin credentials in the deploy environment; script and docs land here; production apply is a deploy-time action recorded in QA. `work_item_messages` stays writable until Step 6 adapter; War Room chat/message/participant/thread/file collections are read-only after this step (War Room rewired in Step 5).

Step 5 — War Room keeps its UI types via `warRoomBridge` mappers; widgets/action_plans stay on `war_room_*`; file links become message attachments (no more `war_room_files` writes).

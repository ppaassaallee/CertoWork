# Collab rebuild — assumptions

Step 1 — Kept `do-product-pane` mount for `/collab` (hidden when in Work) so routing stays stable without a full shell rewrite; ProductSwitcher and Chatwoot product concept are removed.

Step 1 — `CertoProduct` / `productFromPath` / `productHomePath` removed; navigation to Collab uses `/collab` routes only.

Step 3 — Agent/Odysseus/guest-email side-effects in `onMessageCreated` enqueue via `tableEvents.collabHooks` stubs; full HTTP triggers land in Steps 12 and 16.

Step 3 — Storage path for attachments uses `workspaces/{ws}/collab/...`; storage.rules mirror added when Step 4 lands if missing.

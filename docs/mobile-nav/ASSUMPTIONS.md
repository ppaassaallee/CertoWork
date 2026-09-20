# Mobile nav — Assumptions

Step 1 — assumed static code audit instead of Playwright because Playwright is not in package.json and no automated login session exists.
Step 1 — assumed `<AppShell>` = `DelivereeWorkspace`; routes via `resolveDelivereeLens`.
Step 1 — assumed `<CreateMenu>` = inline `.do-create-menu`; `<NewItemDialog>` = `QuickCaptureModal` + `ItemModal`.
Step 1 — assumed `<odysseusContext>` = shell `openOdysseusPanel(scope)` props, not React Context.
Step 1 — assumed mentions inbox source is missing → Inbox › Mentions shows empty state.
Step 1 — reused existing `useMobileCore` (760px) for legacy mobile-core class; new phone UI gates on `useIsPhone()` at **767px** per prompt.
Step 1 — assumed `@hello-pangea/dnd` stays for Daily Plan; swipe uses pointer events (no react-swipeable install required if hand-rolled).
Step 1 — assumed MSheet built custom (no vaul in deps); allowed dependency install deferred unless needed.
Step 3 — tokens live in `src/styles/mobile-tokens.css` (app already has `certo-tokens.css`; additive file to avoid desktop churn).
Step 15 — Inbox unifies reads from `user_notifications`, approvals/review queue, requests, home activity — write nothing new.
Step 21 — desktop unchanged proven by `useIsPhone()` early-return and QA checklist (DOM class `is-phone-shell` absent above 767px).

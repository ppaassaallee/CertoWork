# Mobile nav — Assumptions

Step 1 — assumed static code audit instead of Playwright because Playwright is not in package.json and no automated login session exists.
Step 1 — assumed `<AppShell>` = `DelivereeWorkspace`; routes via `resolveDelivereeLens`.
Step 1 — assumed `<CreateMenu>` = inline `.do-create-menu`; `<NewItemDialog>` = `QuickCaptureModal` + `ItemModal`.
Step 1 — assumed `<odysseusContext>` = shell `openOdysseusPanel(scope)` props, not React Context.
Step 1 — assumed mentions inbox source is missing → Inbox › Mentions shows empty state.
Step 1 — reused existing `useMobileCore` (760px) for legacy mobile-core class; new phone UI gates on `useIsPhone()` at **767px** per prompt.
Step 1 — assumed `@hello-pangea/dnd` stays for Daily Plan; swipe uses `react-swipeable` (installed).
Step 1 — assumed MSheet built custom (no vaul in deps).
Step 3 — tokens live in `src/styles/mobile-tokens.css` (app already has `certo-tokens.css`; additive file to avoid desktop churn).
Step 11 — applied `formatDate` on phone project cards/table; desktop ProjectCommandCenter still uses existing formatters (`formatCheckpointLabel`, `notionShortDate`); full Timestamp hunt deferred if no remaining `Timestamp(` in UI strings.
Step 12 — assumed project detail already adapts via `useMobileCore` tab clamp; kit not fully reapplied — follow-up.
Step 13 — assumed item detail (`ItemModal`) already full-screen on phone; kit not fully reapplied — follow-up.
Step 15 — Inbox unifies reads from existing sources when wired; Mentions empty until feed exists; writes nothing new.
Step 19 — Playwright re-audit skipped; static AUDIT table closed with decisions.
Step 20 — tap targets ≥44 via MIconButton/MButton; safe-area on tab bar/FAB/sheets; input font-size 16px; reduced-motion in tokens.
Step 21 — desktop unchanged via `useIsPhone` gate; QA checklist in QA.md.

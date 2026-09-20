# Features 2026-09 — Assumptions

Step 1 — assumed `<llmCall>` = `sendBoldiChat` for prose polish; template brief is source of truth for numbers.
Step 1 — assumed `<ProjectsCosts>` = `ProjectFinanceLedger` + portfolio economics.
Step 1 — assumed roles for invoice writes = workspace `admin` / `owner` (no dedicated `finance` role yet).
Step 1 — TTS = browser `speechSynthesis` behind Listen control; no cloud TTS unless `VITE_TTS_ENABLED`.
Step 1 — email reminders use mailto draft + `reminderSentAt` when Brevo not configured for client mail.
Step 2 — desktop kit in `src/desktop/ui/` additive; does not replace mobile kit.
Step 3 — brief generation runs client-callable with template-first; Cloud Function `generateBrief` scaffolds same logic when functions deploy.
Step 3 — `briefs/{uid}_{date}` allows own-uid client write until CF-only writes are enforced in production; ASSUMPTION logged.
Step 4 — brief routine uses `onSchedule` stub + regenerate-on-Home-open (>3h).
Step 11 — invoice `overdue` derived on read + daily flip function scaffold.
Step 14 — view system extends `lib/views` with invoice scope types; popover additive.
Step 19 — icon rail wraps existing sidebar content rather than deleting routes.
Step 23 — routine builder scaffolds canvas; non-prompt nodes Coming soon if engine is prompt-only.
Step 25 — project gallery skipped if overview view type not ready — logged.

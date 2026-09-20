# QA — Phase A (Daily Brief + Signals)

## Flag off
- [ ] `flags.dailyBrief` unset → Home renders `data-testid="home-cockpit"` (legacy).
- [ ] DOM snapshot of Home matches pre-feature layout (stat grid / triage present).

## Flag on
- [ ] Home renders `data-testid="home-cockpit-brief"` with Daily Brief card gradient.
- [ ] Template brief builds when LLM unavailable (`source: 'template'`).
- [ ] `validateBriefNumbers` rejects invented large amounts (see `tests/brief-template.test.ts`).
- [ ] Regeneration skipped when `inputsHash` unchanged (`force=false`).
- [ ] `dailyBriefRoutineTick` writes brief + notification at configured `briefAt` (default 07:00).
- [ ] Home auto-refreshes when stored brief older than 3 hours.
- [ ] Prepare sheet opens from Next event → linked items listed; What to bring falls back to open items.
- [ ] Signals appear in Odysseus panel; dismiss/snooze persist; no duplicate `entityKey+kind`.
- [ ] Status answers render via `renderOdysseusAnswer` with 2×2 stats.
- [ ] Phone Home can show the same brief card when flag on (mobile shell).

## Commands
```bash
npm test
npm run build
```

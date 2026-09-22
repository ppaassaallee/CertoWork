# Clean UI Track A — QA

## Parity gate (A7)

| Check | Result |
|-------|--------|
| Routes snapshotted | 38 |
| Controls (after) | 5908 |
| Diff vs A0 baseline | **0** (lost 0 / added 0) |
| Collections | identical |
| `npm test` pass count | 667 ok (671 total incl. suites) — matches A0 |
| Mode | Static source analysis (Playwright deferred — see ASSUMPTIONS.md) |

Comparator keys by `routeId` + `testid|handlerHash` (whitespace-normalized names). Path collisions (`/my-work` for assigned + issues) are disambiguated.

## Before / after

Screenshot placeholders live in `docs/clean-ui/parity/before/` and `after/` (text notes per route; no headed browser in this environment).

### Visual checklist delivered

- A1 Tokens: `#2547C4` accent, `#F2620F` signal, priority/state/activity glyphs
- A2 Shell: 56px top bar, centered ⌘K, Odysseus pill, 64px rail, 236px panel
- A3 Project header 52px + underline tabs + ViewsBar
- A4 Board cards: type tile, mono ID, priority bars, 300px columns
- A5 Modals/sheets/buttons/focus/toasts
- A6 Page wash unification

## Bundle

`npm run build` succeeds. CSS gzip ~107–108 kB (minor delta from tokens/pages kit).

## Accessibility / Lighthouse

Deferred (no public deploy URL in agent). Follow-up in FOLLOW-UPS.md.

## Verdict

**Track A parity gate passed.** Proceed to Track B (additive only; re-run compare with `--allow-additions`).

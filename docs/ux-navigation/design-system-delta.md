# Design system delta (Certo Calm Authority → low-chrome IA)

SSOT remains `src/styles/certo-tokens.css`. Do **not** replace the brand.

## Change only what navigation needs

| Token / pattern | Current | Target |
| --- | --- | --- |
| Sidebar width | ~278px | 248px default (`--nav-width`) |
| Nav row height | varies | ~32px |
| Nav label | mixed | 13–14px, weight ≤600 |
| Colored nav categories | category-tinted icons | Neutral icons; accent only for active/semantic |
| Brand row | large + tagline | Compact workspace switcher |
| Hire card | large Odysseus CTA in primary stack | Quiet Agents entry; Odysseus inside Agents |
| Cards on Home | attention rows (good) | Keep rows; no KPI card explosion |
| Command Center H1 | marketing tower language | “Projects” page title |

## CSS hooks added in this refactor

- `.do-nav-admin` — pinned administrative cluster
- `.do-my-work-tabs` — Assigned / Inbox / Waiting
- `.do-agents-home` — Agents landing
- `.do-sidebar` search affordance row (⌘K)

## Explicit non-goals

- No Notion clone fonts, purple, or cream editorial theme
- No wholesale hex purge of specialty islands (War Room / fitness)

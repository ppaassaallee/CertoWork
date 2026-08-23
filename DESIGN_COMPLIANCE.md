# Certo Calm Authority — compliance summary

Audit date: 2026-08-21  
Scope: full product UI on branch `cursor/design-language-audit-7a36` (includes Prompt 1 UX overhaul).  
SSOT: `src/styles/certo-tokens.css` + `DESIGN_LANGUAGE.md`.

## Step 1 delivered

| Artifact | Path |
| --- | --- |
| Tokens + primitives | `src/styles/certo-tokens.css` |
| Design language doc | `DESIGN_LANGUAGE.md` |
| Tailwind mapping | `tailwind.config.js` → Certo tokens |
| Global import | `src/index.css` imports tokens + Inter |

## Route audit (Prompt 2 order)

### 1. Navigation shell

| Rule | Element | Fix |
| --- | --- | --- |
| Raw hex | Sidebar / brand / nav | Mapped to `--surface-*`, `--accent`, `--text-*`, `--border` |
| Typography | Manrope / DM Sans / weight 700–800 | Inter + max weight 600 in chrome |
| Accent | Logo mark | Uses `--accent-hover` (mark), not decorative fills |
| Nav active | `.do-nav-item.is-active` | Forced `--accent-soft` + accent text |
| Breadcrumbs / ⌘K | From Prompt 1 | Kept; focus rings via `:focus-visible` |
| Destructive visibility | Project row actions | Hover/focus only (Prompt 1) |

### 2. Command Center

| Rule | Element | Fix |
| --- | --- | --- |
| Accent count | Head action buttons | Demoted to secondary outline; Templates/Dashboard not filled accent |
| Zero metrics | Hours / $0 cards | Muted + inline CTA (Prompt 1) |
| Status chips | Portfolio health | Already labeled StatusLight + filterable |
| Double close | Templates overlay | Page X hidden while open (Prompt 1) |
| Eyebrows | DELIVERY CONTROL TOWER | Forced `.do-project-card-kicker` eyebrow tokens |

### 3. Project Console (all tabs)

| Rule | Element | Fix |
| --- | --- | --- |
| Density | Header | Compact band ≤96px (Prompt 1) |
| Accent | Share / PDF / Team / controls | Demoted to secondary; no full-width filled Share |
| Stage color-only | Stage select | Text labels retained |
| Tabs | Active tab | `--accent-soft` pill pattern enforced |
| Costs | Add period | Sheet + Create Build V1 CTA (Prompt 1) |
| Team | Unassigned | Assign… affordance; Sharing & access (Prompt 1) |
| Backlog | Filter wall | Filter/Sort/Views (Prompt 1) |
| tabular-nums | Stat strip / finance | Applied to summary strong values |

### 4. Odysseus

| Rule | Element | Fix |
| --- | --- | --- |
| Marketing hero | Slogan | Replaced with agent home + queues first (Prompt 1) |
| Accent | Send / primary job CTA | Remains single filled primary (`.do-send`, `.do-button-dark`) |
| Status | Attention queues | StatusLight + labels |

### 5. Templates

| Rule | Element | Fix |
| --- | --- | --- |
| Overlay chrome | Dual X | One close (Prompt 1) |
| Buttons | Create/apply | Secondary by default; primary only where `.cw-btn-primary` |

### 6. Settings / Approvals

| Rule | Element | Fix |
| --- | --- | --- |
| Accent discipline | Approve action | Kept as sole filled primary on Approvals list items |
| Workspace admin fills | Create/admin buttons | Demoted to outline secondary |

## System-wide remaps

- ~1,300+ raw hex occurrences in `src/index.css` replaced with tokens (remaining ~800 are niche legacy hues, rgba, or third-party islands — see Deferred).
- `cw-btn*` primitives redefined in tokens (primary = `--accent`, not black ink).
- Accent-discipline override block demotes known multi-button green fills to outline, then re-allows a short whitelist of true primaries.

## Intentionally deferred

| Item | Why |
| --- | --- |
| Exhaustive zero-hex in every CSS rule | War Room / fitness / notebook islands still carry specialty palette hues; migrating them is a dedicated pass without blocking Calm Authority on core delivery surfaces. |
| Full Empty/Loading/Error on every legacy list | Core consoles covered; obscure modules still use older empties — migrate as those screens are touched. |
| Skeleton loaders everywhere | Prompt asks skeletons over full-page spinners; conversation stream still uses work-log motion — swap in a follow-up. |
| ES/EN chrome purity across every string | i18n keys exist for nav/Odysseus; deep project copy still English-first — language pass is separate product work. |
| Tailwind shadcn HSL vars | Replaced with direct Certo token colors; leftover unused hsl theme keys removed from config. |

## How to verify

1. Open Home → confirm sidebar tokens + breadcrumbs.  
2. Command Center → at most one filled primary; zero metrics muted.  
3. Project console → compact header; Share not full-width green.  
4. Backlog → Filter/Sort, not filter wall.  
5. Odysseus → queues before chrome; one send primary.  
6. Tab through controls → accent focus ring visible.

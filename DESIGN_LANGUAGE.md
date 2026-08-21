# Certo Calm Authority

Quiet, editorial, ops-grade UI. Deep green means **decide / act**. Everything else stays neutral. Density like Linear, warmth like Asana, discipline like Apple.

**Single source of truth:** `src/styles/certo-tokens.css`  
**Do not** invent raw hex, arbitrary `px` type sizes, or one-off radius/shadow values in components.

---

## Color

### Neutrals (~95% of every screen)

| Token | Value | Use |
| --- | --- | --- |
| `--surface-0` | `#FFFFFF` | Cards, panels |
| `--surface-1` | `#F7F8F7` | App background |
| `--surface-2` | `#EFF1EF` | Hover, wells, input fills |
| `--border` | `#E3E6E3` | Dividers, card edges |
| `--text-primary` | `#1A1F1C` | Body / titles |
| `--text-secondary` | `#5B645F` | Supporting copy |
| `--text-muted` | `#8A938D` | Eyebrows, hints |

### Accent (max ~5% of any screen)

| Token | Value |
| --- | --- |
| `--accent` | `#1E4633` |
| `--accent-hover` | `#163828` |
| `--accent-soft` | `#E7EFEA` |

**Accent may appear only on:**

1. The single primary button of a screen  
2. Active tab / nav indicator (`--accent-soft` pill or soft fill)  
3. Links and focus rings  
4. Progress fill  

Never fill large surfaces. Never two filled primary buttons on one screen. Never decorative accent blocks.

### Status (meaning only)

| Token | Strong | Soft | Meaning |
| --- | --- | --- | --- |
| Success | `--status-success` | `--status-success-soft` | On track |
| Warning | `--status-warning` | `--status-warning-soft` | At risk |
| Danger | `--status-danger` | `--status-danger-soft` | Blocked |

Status color **always** ships with a text label or icon + accessible name. Soft = chips/backgrounds. Strong = dots, icons, text.

---

## Typography

- **Face:** Inter (product workhorse). Weights **400 / 500 / 600** only in chrome — never 700.
- **Scale (1.25):** 12 caption · 13 body-sm · 14 body · 16 body-lg · 18 h4 · 22 h3 · 28 h2 · 34 h1  
- **Eyebrows** (`DELIVERY CONTROL TOWER`, etc.): 11px, weight 600, letter-spacing `0.08em`, `--text-muted` — product signature; keep identical everywhere.
- Line height: 1.5 body, 1.25 headings. Stats / money use `tabular-nums`.

---

## Spacing, radius, elevation

- **4px grid:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64  
- **Radius:** 8 controls · 12 cards · 16 modals · 999 pills  
- **Elevation:** borders over shadows. `shadow-sm` popovers only; `shadow-md` modals only. Cards = border, no shadow.  
- Card padding 16 compact / 24 standard. Page gutter 24. Reading max width 1440 centered.

---

## Components (primitives)

Use CSS primitives in `certo-tokens.css` / shared classes:

- **Button** — primary / secondary / tertiary / destructive · heights 32 / 40  
- **Input + Select** — 40px, shared chevron  
- **Tabs** — active = `--accent-soft` pill  
- **Chip** — status, filter, removable  
- **EmptyState** — 24px muted icon + headline + one line + one primary CTA  
- **Modal/Sheet, Toast (+ undo), Tooltip, Avatar, Breadcrumb, Table row (56px, hover `--surface-2`)**

Locally styled clones that bypass these are violations.

---

## Voice

- Sentence case except eyebrows.  
- Buttons say the outcome (“Save template”, not “Submit”).  
- One UI language per user setting (ES **or** EN) — no mixed chrome in a view.  
- Errors: what happened + how to fix. Empty states invite action.

---

## Keyboard & focus

- Visible focus: `--focus-ring` (accent, 2px effective).  
- Esc closes **only** the topmost overlay.  
- ⌘K command palette; logical tab order.

---

## Density

First meaningful content within **~200px** of the top on desktop consoles (after Prompt 1 compact headers).

---

## Compliance workflow

1. New UI → tokens only.  
2. Accent count ≤ 1 filled primary per screen.  
3. Status colors labeled.  
4. Empty / loading / error for every data surface.  
5. Contrast ≥ 4.5:1 (3:1 for ≥18px text).

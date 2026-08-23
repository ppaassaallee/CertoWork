# CERTO WORK — NOTION-STYLE REDESIGN (WHITE MINIMAL)

Mission: replace the current green-tinted "Calm Authority" language with a
Notion-style white minimal system. This document tells you WHAT to change,
HOW to change it (exact hex values, exact files, exact commands), and HOW TO
VERIFY each phase so the change cannot be partial.

**Why the last attempt failed (read this first):** the token file
`src/styles/certo-tokens.css` was created, but (a) the accent stayed forest
green `#1e4633`, (b) the "neutral" grays are green-tinted (`#f7f8f7`,
`#e3e6e3`, `#1a1f1c` all have a green cast), and (c) **679 hardcoded hex
values remain in `src/index.css`** plus raw hex in 15+ TSX components that
never read the tokens. Changing tokens alone changes almost nothing on
screen. This time the job is: fix the tokens AND migrate every hardcoded
color, with grep gates that must return zero before you may stop.

Rules of engagement:
- Work phase by phase, in order. Do not skip verification gates.
- `npm run lint`, `npm run test`, `npm run build` must pass after each phase.
- Zero functional changes. This is visual language only.

---

## PHASE 0 — BASELINE AUDIT (5 min, do not skip)

Run and SAVE the output; these numbers must reach zero by Phase 3.

```bash
# Count hardcoded hex in stylesheet (baseline ≈ 679)
grep -c "#[0-9a-fA-F]\{6\}\b" src/index.css

# List TSX files with hardcoded hex (baseline ≈ 15+)
grep -rln "#[0-9a-fA-F]\{6\}" src/components --include="*.tsx"

# List every green-family hex currently in use (for the mapping table)
grep -o "#[0-9a-fA-F]\{6\}\b" src/index.css | tr 'A-F' 'a-f' | sort -u
```

---

## PHASE 1 — REPLACE THE TOKEN VALUES (the Notion palette)

Edit `src/styles/certo-tokens.css`. Replace the values ONLY — keep every
variable name identical so nothing else breaks. This is the exact Notion
light-mode palette:

```css
:root {
  /* ============ NEUTRALS — Notion white ============ */
  /* Notion's grays are warm (brownish), never green. */
  --surface-0: #ffffff;              /* page / cards */
  --surface-1: #f7f7f5;              /* sidebar, app background */
  --surface-2: #f1f1ef;              /* hover fills, wells */
  --border:    #e9e9e7;              /* hairline borders */
  --border-strong: rgba(55, 53, 47, 0.16);  /* inputs, focused cells */

  --text-primary:   #37352f;         /* Notion ink — NOT pure black */
  --text-secondary: #787774;
  --text-muted:     #9b9a97;

  --hover-overlay:  rgba(55, 53, 47, 0.06); /* row/button hover */
  --active-overlay: rgba(55, 53, 47, 0.10); /* pressed / selected */

  /* ============ ACCENT — Notion blue (kills the green) ============ */
  --accent:       #2383e2;
  --accent-hover: #1a73c7;
  --accent-soft:  #e7f3f8;
  --accent-on:    #ffffff;

  /* ============ SEMANTIC STATUS — Notion tag colors ============ */
  /* Soft pastel background + dark readable text, like Notion tags. */
  --status-success:       #1c7a52;
  --status-success-soft:  #dbeddb;   /* Notion green tag bg */
  --status-warning:       #9f6b00;
  --status-warning-soft:  #fdecc8;   /* Notion yellow tag bg */
  --status-danger:        #c4554d;
  --status-danger-soft:   #ffe2dd;   /* Notion red tag bg */
  --status-info:          #2383e2;
  --status-info-soft:     #d3e5ef;   /* Notion blue tag bg */
  --status-neutral:       #787774;
  --status-neutral-soft:  #f1f1ef;

  /* Keep every legacy alias block that already exists below this point
     (--status-green, --ink, --paper, --green, --nav-*, etc.) — they now
     inherit the new values automatically. ONE exception: */
  --green: var(--accent);   /* legacy name, must now point to blue accent */

  /* ============ ELEVATION — Notion shadows ============ */
  --shadow-sm: rgba(15, 15, 15, 0.05) 0 0 0 1px,
               rgba(15, 15, 15, 0.10) 0 3px 6px;
  --shadow-md: rgba(15, 15, 15, 0.05) 0 0 0 1px,
               rgba(15, 15, 15, 0.10) 0 3px 6px,
               rgba(15, 15, 15, 0.20) 0 9px 24px;

  /* ============ RADIUS — Notion is tighter than the current 12/16 ==== */
  --radius-control: 6px;
  --radius-card:    8px;
  --radius-modal:   10px;

  /* ============ FOCUS ============ */
  --focus-ring: 0 0 0 2px var(--surface-0), 0 0 0 4px var(--accent);
}
```

Also in this file:
- `.cw-btn-primary` stays on `var(--accent)` → now renders Notion blue.
- `.cw-select` background-image chevron: change stroke `%238A938D` →
  `%239B9A97`.

**Typography (same file):** keep Inter. Notion sizing is compact:
- `--text-body: 14px`, `--text-body-sm: 13px`, `--text-caption: 12px` (keep)
- Change `--leading-body` to `1.5` (keep) and `--font-weight-semibold: 600`
  (keep). No serif anywhere, no letter-spacing on body text.

### GATE 1
```bash
grep -n "1e4633\|163828\|e7efea" src/styles/certo-tokens.css   # → must be empty
grep -n "2383e2" src/styles/certo-tokens.css                    # → must match
```

---

## PHASE 2 — PURGE HARDCODED HEX FROM index.css (the real work)

`src/index.css` (~2,900 lines) has ~679 raw hex values. Every one must
become a var(). Method:

### Step 2.1 — Mechanical bulk replacement of the green-gray families

The old palette is systematic, so map families → tokens. Run these seds
(review the diff after each batch with `git diff --stat src/index.css`):

```bash
cd src
# --- Near-white greenish surfaces → surface tokens
sed -i -E 's/#(fbfcfa|fafbf9|f8fbf8|fbfdfb|f9fbf9|fafcfa)/var(--surface-0)/gI' index.css
sed -i -E 's/#(f2f5f2|f1f3f1|eef3ef|eef2ef|edf4ef|edf0ee|f2f7f3|eef1e9)/var(--surface-1)/gI' index.css
sed -i -E 's/#(e8ebe8|e3e8e4|e1e7e2|e1e6e1|dfece2|dce2dd|dfe7e2|dce6de|d9e0da|d4e0d7)/var(--border)/gI' index.css

# --- Green-tinted grays → text tokens (darkest→primary, mid→secondary, light→muted)
sed -i -E 's/#(1a1f1c|222924|253029)/var(--text-primary)/gI' index.css
sed -i -E 's/#(5b645f|68756d|65736a|68776d|6b7a70|748078|7d8781|746c5e)/var(--text-secondary)/gI' index.css
sed -i -E 's/#(8a938d|8b978f|9da39f|8d9891|8b968f|87938b|87928b|87918b|839087|89948d)/var(--text-muted)/gI' index.css

# --- Forest greens (brand + health) → accent / status
sed -i -E 's/#(295841|285b43|1e4633|163828|315c44|345b44|42564a|46534c|688073)/var(--accent)/gI' index.css
sed -i -E 's/#(5a9a70|1f7a45)/var(--status-success)/gI' index.css

# --- Rusty reds / ambers → status tokens
sed -i -E 's/#(a34d40|a5493a|a04c3e|a14e40|c2352b)/var(--status-danger)/gI' index.css
sed -i -E 's/#(f8ece9|f5eeeb|f2dfdb|e8cec8|fcebe9)/var(--status-danger-soft)/gI' index.css
sed -i -E 's/#(9a6922|b07500|687235)/var(--status-warning)/gI' index.css
```

### Step 2.2 — Manual sweep of the remainder

The seds won't catch everything. Loop until zero:

```bash
grep -n "#[0-9a-fA-F]\{6\}\b" src/index.css | head -40
```

For each survivor, classify and replace by ROLE, not by eyeballing the hex:
- backgrounds of pages/panels/cards → `--surface-0/1/2`
- borders/dividers → `--border`
- any text color → `--text-primary/secondary/muted`
- anything green that means "brand/link/active" → `--accent`
- anything that means good/bad/warning state → the `--status-*` pair
- rgba() shadows → `--shadow-sm` / `--shadow-md`
- hover backgrounds → `--hover-overlay`

Rule: if a color's role is genuinely ambiguous, it becomes
`--text-secondary` (text) or `--surface-1` (fill). Never leave a hex.

### Step 2.3 — Notion feel adjustments while you are in this file

1. **Sidebar** (`.do-sidebar`): background `var(--surface-1)` (#f7f7f5),
   NO border-right — Notion separates by tone, not by line. Sidebar item
   hover = `var(--hover-overlay)`, active = `var(--active-overlay)` with
   `font-weight: 500`, radius 4px, height 28px, padding 0 8px.
2. **Cards**: `border: 1px solid var(--border)` + `--radius-card` (8px),
   no shadow at rest; `--shadow-sm` only on hover of clickable cards;
   `--shadow-md` only for modals/popovers.
3. **Header**: pure `var(--surface-0)`, height ≤ 48px,
   `border-bottom: 1px solid var(--border)`.
4. **Buttons**: text/ghost by default. Only ONE filled blue primary per
   screen. Secondary = white bg + `--border` + `--text-primary`.
5. Remove every `background: linear-gradient(...)` used for chrome.
   Notion has zero gradients.
6. Delete any remaining vignette/hero art on the sign-in page; the sign-in
   becomes: white page, small logo, one heading `--text-h2`, one blue
   primary button, one text link.

### GATE 2
```bash
grep -c "#[0-9a-fA-F]\{6\}\b" src/index.css     # → MUST print 0
grep -c "gradient" src/index.css                 # → MUST print 0
npm run build                                    # → must pass
```

---

## PHASE 3 — PURGE HEX FROM COMPONENTS (TSX)

These files have inline hex (baseline list — re-run the grep, it is
authoritative): `WarRoom.tsx`, `ProjectSurfaces.tsx`,
`BoldiFloatingWidget.tsx`, `TimeBlocksPlanner.tsx`,
`Habits/HabitMatrixGrid.tsx`, `Habits/HabitsHome.tsx`,
`Habits/HabitDetailPage.tsx`, `DailyMetrics.tsx`, `DailyClarityModal.tsx`,
`NotesWorkspace.tsx`, `ProjectHealthCommandCenter.tsx`,
`NotebookPlanner.tsx`, `ProjectDetails.tsx`, `ProjectsList.tsx`,
`BoldrOS/BoldrOSHub.tsx`.

How:
1. Inline styles → `style={{ color: "var(--text-secondary)" }}` etc., same
   role-mapping as Step 2.2.
2. Recharts colors → create `src/lib/chartColors.ts`:
   ```ts
   // Notion tag palette — the ONLY colors charts may use
   export const CHART_COLORS = [
     "#2383e2", // blue
     "#1c7a52", // green
     "#9f6b00", // yellow
     "#c4554d", // red
     "#9065b0", // purple
     "#d9730d", // orange
   ];
   export const STATUS_CHART = {
     success: "#1c7a52", warning: "#9f6b00", danger: "#c4554d",
   };
   ```
   Every chart imports from here; no inline hex in chart props.
3. Add the lint fence so hex can never come back:
   in `eslint.config.js`, add to rules:
   ```js
   "no-restricted-syntax": ["error", {
     selector: "Literal[value=/#[0-9a-fA-F]{6}/]",
     message: "No raw hex in components. Use CSS variables or chartColors.ts",
   }],
   ```
   (Scope it to `src/components/**` and exempt `chartColors.ts`.)

### GATE 3
```bash
grep -rln "#[0-9a-fA-F]\{6\}" src/components --include="*.tsx" \
  | grep -v chartColors    # → MUST print nothing
npm run lint               # → must pass with the new rule active
```

---

## PHASE 4 — ICONS, NOTION STYLE

Notion's icon set is proprietary — do NOT copy their SVGs. Replicate the
style with lucide-react (already installed), which at thin stroke is
visually equivalent:

1. Create/replace `src/components/ui/Icon.tsx`:
   ```tsx
   import * as L from "lucide-react";
   type Name = keyof typeof L;
   const SIZES = { sm: 14, md: 16, lg: 18 } as const;   // Notion runs small
   export function Icon({ name, size = "md", className }: {
     name: Name; size?: keyof typeof SIZES; className?: string;
   }) {
     const C = L[name] as React.ComponentType<L.LucideProps>;
     return (
       <C
         size={SIZES[size]}
         strokeWidth={1.5}                 /* Notion-thin, never 2 */
         color="currentColor"
         className={className}
         aria-hidden="true"
       />
     );
   }
   ```
2. Default icon color is `var(--text-muted)` (#9b9a97) — Notion icons are
   always quieter than their labels. Active/hover state may go
   `--text-primary`. Icons NEVER use the accent color except inside a
   primary button.
3. Migrate all direct lucide imports to `<Icon name="..."/>`, then fence:
   ```js
   "no-restricted-imports": ["error", { paths: [{
     name: "lucide-react",
     message: "Import Icon from components/ui/Icon instead.",
   }]}],
   ```
   (exempt `src/components/ui/Icon.tsx`).
4. Reduce icon count Notion-style: sidebar items get ONE small icon at 16px;
   buttons with visible labels get NO icon except: search, close, back,
   plus, settings, drag-handle. Delete decorative icons (sparkles on
   headings, etc.).

### GATE 4
```bash
grep -rln "from \"lucide-react\"" src --include="*.tsx" \
  | grep -v "ui/Icon.tsx"   # → MUST print nothing
```

---

## PHASE 5 — TEXT HARMONY (todos los textos en armonía)

One pass over the whole UI enforcing a single type ramp. Notion uses very
few sizes; so will Certo:

| Role | Token | Size | Weight | Color |
|---|---|---|---|---|
| Page title | --text-h2 | 28px | 700 | --text-primary |
| Section title | --text-h4 | 18px | 600 | --text-primary |
| Card title / row title | --text-body | 14px | 500 | --text-primary |
| Body | --text-body | 14px | 400 | --text-primary |
| Secondary line | --text-body-sm | 13px | 400 | --text-secondary |
| Caption / meta / dates | --text-caption | 12px | 400 | --text-muted |
| Eyebrow (rare) | --text-caption | 12px | 500 | --text-muted, NO uppercase |

How to enforce:
1. `grep -n "font-size" src/index.css` — every occurrence must resolve to
   one of the 5 tokens above. The legacy `calc(7px…)`, `calc(8.5px…)` etc.
   micro-sizes are all bumped to `--text-caption` minimum. Nothing under
   12px anywhere (accessibility + Notion never goes below 12).
2. Kill ALL `text-transform: uppercase` + wide letter-spacing eyebrows —
   Notion doesn't shout. `grep -c "uppercase" src/index.css` → 0.
3. Max two font weights visible per surface (400 + 500/600).
4. Headings: `letter-spacing: -0.01em` max; body: 0.

### GATE 5
```bash
grep -n "font-size: *calc(\(7\|8\|9\|10\|11\)" src/index.css  # → empty
grep -c "uppercase" src/index.css                              # → 0
```

---

## PHASE 6 — FINAL VISUAL QA (screenshot checklist)

Run the app and check each screen against this list. Fix on the spot.

- [ ] Zero green anywhere except the success status chip/dot
- [ ] Sidebar is #f7f7f5, content is pure white, no border between them
- [ ] Exactly one blue (#2383e2) filled button per screen, all other
      buttons are ghost/outline
- [ ] All status chips look like Notion tags: soft pastel bg, dark text,
      pill radius, 12px font
- [ ] Icons: thin (1.5), small (16px), gray (#9b9a97), no decorative ones
- [ ] No shadows at rest; subtle shadow on hover/popovers only
- [ ] No gradients, no vignettes, no hero art
- [ ] Type: only 5 sizes on screen; nothing smaller than 12px; no uppercase
- [ ] Hover states everywhere = faint gray overlay, 100–150ms
- [ ] Sign-in page: white, logo, heading, one blue button — nothing else

## FINAL ACCEPTANCE (all must be true to close the task)
```bash
grep -c "#[0-9a-fA-F]\{6\}\b" src/index.css                      # 0
grep -rln "#[0-9a-fA-F]\{6\}" src/components --include="*.tsx" \
  | grep -v chartColors                                          # empty
grep -rln "from \"lucide-react\"" src --include="*.tsx" \
  | grep -v "ui/Icon.tsx"                                        # empty
grep -c "uppercase" src/index.css                                # 0
grep -c "gradient" src/index.css                                 # 0
npm run lint && npm run test && npm run build                    # all pass
```
Report the before/after numbers from Phase 0 in your summary.

# Mobile nav — Dead-control audit

**Method:** Static code audit (Step 1.2 Playwright skipped — no Playwright in `package.json`; no automated login session). Assumption logged in ASSUMPTIONS.md.

Viewport target: 390×844 (documented decisions apply at phone widths).

| Route | Element | Problem | Decision |
|-------|---------|---------|----------|
| /my-work | Try Daily Plan | Contrast: white/light text on light-blue banner; may appear inert if flag write fails | **fix** — MButton primary + `enableDailyPlan` (Step 7) |
| /my-work | + View | Opens create view but buried in duplicated chrome | **move-to** View sheet (Step 8) |
| /my-work | Customize | Opens customizer; desktop columns irrelevant on phone | **move-to** View sheet / remove columns UI on phone (Step 8) |
| /my-work | Filter / Sort / Group toolbar | Four controls duplicating ViewsBar | **remove** on phone; Filter & sort sheet (Step 8) |
| /my-work | Select all | Desktop bulk pattern | **remove**; long-press multi-select (Step 8) |
| /my-work | Assigned/Inbox/Waiting + My view/Today chips | Two duplicated tab rows | **remove**; MSegmented Today·My items·Events (Step 7) |
| / | Triage with Odysseus | Duplicate Odysseus entry | **remove**; header icon (Step 6/17) |
| / | Stat grid 42/33/0… | Noise / zero-filled | **remove** (Step 6) |
| / | 0 approvals · 0 requests · 0 mentions | Zero-count sentence | **remove**; Needs attention only if >0 (Step 6) |
| / | Activity: Odysseus completed a run | Noise on Home | **move-to** Inbox › Updates (Step 15) |
| /projects | Ask about this portfolio… | Duplicate Odysseus | **remove**; header (Step 10/17) |
| /projects | Rutina / Ask buttons | Duplicate entry points | **remove** (Step 10) |
| /projects | New project text button | Wraps; black-ish style | **remove**; FAB (Step 10/16) |
| /projects | Nine filter dropdowns + horizontal table | Desktop squeezed | **move-to** Filter sheet + cards (Step 11) |
| /projects | Views & columns / Default / + View | Desktop views chrome | **move-to** View sheet (Step 11) |
| /projects | Timestamp( cells | Raw object string | **fix** `formatDate` (Step 11) |
| * | Hamburger drawer | Duplicates tab bar | **remove** on phone (Step 4) |
| * | Bell / chat / gear / breadcrumb / black Create | Overcrowded top bar | **remove** on phone (Step 4); functions → Inbox / Profile / FAB |
| * | Chat Collab toggle in drawer | Product surface toggle | **audit** → Workspace sheet segment or remove if inert (Step 5) |
| * | ⌘⏎ hints in create | Touch-hostile | **remove** on phone (Step 16) |
| * | Tap targets < 44px (icon tools) | A11y | **fix** MIconButton 44px (Step 3/20) |
| * | Horizontal overflow on tables | Layout | **fix** cards / contained table (Steps 8, 11) |
| drawer | Projects/Notes entries | Duplicate of tabs | **remove** from phone (drawer gone) |
| /projects row icons | folder/warning/sparkle/archive | Tiny targets | **move-to** row actions sheet (Step 11) |
| create | create & another | Exists as option; keep as toggle | **fix** in Create sheet (Step 16) |
| /notes | Empty right pane “Pick a note…” | Desktop split | **remove** on phone (Step 14) |

Decisions completed through Step 19; hashes filled in Step 19 sweep.

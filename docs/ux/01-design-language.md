# Certo Work — design language

Point of view: calm, exact, and a little formal. The product is a cockpit, not a dashboard wall. One primary action per screen. Status color is information. Names are what people read; ids are what they copy.

Tokens already live in `src/styles/tokens.css` (Plane clean-UI) and are aliased in `src/styles/certo-tokens.css`. New UI uses those names. Do not add a third palette.

## Type

Inter for everything, including headings. JetBrains Mono only for ids, keys, and code, and only at caption size.

| Token | Size | Use |
| --- | --- | --- |
| `--t-xs` | 11.5px | Eyebrow, meta |
| `--t-sm` | 12.5px | Row meta, chips |
| `--t-md` | 14px | Body and controls |
| `--t-lg` | 15px | Emphasized body |
| `--t-xl` | 17px | Section title |
| `--t-2xl` | 22px | Screen title |

Weights: 400 body, 500 labels, 600 titles. No 700 in product chrome. Line height 1.45 for body, 1.25 for titles. Tabular numbers on every count, date, and money value. The existing text-size control (`--cw-text-scale`, steps 1–5) stays and must keep scaling these sizes.

## Space

4px base. Use `--sp-1` through `--sp-6` (4, 8, 12, 16, 22, 32). Do not invent 6, 10, or 14 except inside an existing component that already depends on them.

| Use | Token |
| --- | --- |
| Icon gap | `--sp-2` |
| Control padding | `--sp-3` |
| Card padding | `--sp-4` |
| Section gap | `--sp-5` |
| Page padding | `--sp-6` |

Row height `--h-row` 44px, compact `--h-row-compact` 36px. Controls `--h-ctrl` 36px, small `--h-ctrl-sm` 30px. Radius `--r-s` 7, `--r-m` 10, `--r-l` 12, `--r-xl` 14. One radius per surface: controls `--r-m`, cards `--r-l`, overlays `--r-xl`.

## Color

Light values are the current `:root` in `tokens.css`. Dark values below are the target for `[data-theme="dark"]`. They are not implemented yet. Ship them as a token sheet before any screen claims dark mode.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas `--c-wash` | `#f7f8fa` | `#14161c` |
| Panel `--c-panel` | `#ffffff` | `#1c1f27` |
| Column `--c-col` | `#eff1f5` | `#232733` |
| Line `--c-line` | `#e6e8ee` | `#313645` |
| Ink `--c-ink` | `#1f2430` | `#f3f4f6` |
| Ink 2 `--c-ink-2` | `#6b7280` | `#b6bcc8` |
| Ink 3 `--c-ink-3` | `#9ca3af` | `#8b93a3` |
| Accent `--c-accent` | `#2547c4` | `#8eaaef` |
| Accent wash | `rgba(37,71,196,.08)` | `rgba(142,170,239,.16)` |
| OK `--c-ok` | `#3aae6c` | `#6dcca0` |
| Warn `--c-warn` | `#e8b23a` | `#e8c36a` |
| Bad `--c-bad` | `#e0433a` | `#f0928c` |
| Signal `--c-signal` | `#f2620f` | `#f59a62` |

Accent is for the primary action, the current nav item, and focus. It is not a decoration. Status hues (`--sem-*`) are for chips only. One hue per fact: overdue is bad, waiting is warn, done is ok, info is accent. Never color a whole row red. A 2px leading mark or a chip is enough.

Contrast: ink on panel and accent-on-white must stay at least WCAG AA (4.5:1 for text, 3:1 for controls). The “Plan your day” treatment fails this today and is a P1 fix. Focus ring stays `--focus-ring`: 2px panel, 2px accent, visible on light and dark.

## Density

Two modes, remembered per user.

- **Comfortable (default):** 44px rows, chips visible for status, date, owner, client. Secondary actions appear on hover, focus, or when the row is selected.
- **Compact:** 36px rows, same chips, tighter page padding (`--sp-4`). Chosen from Settings, not inferred from window size.

Phone layout is a third layout, not a third density. It keeps one primary action and hides the rest in the overflow menu.

## Icons

Lucide, 16px default, 14px in a row, 12px only in meta. Stroke 1.5. One icon per control, and the control has a visible name or an `aria-label` that includes the object (“Delete Annual plan”, not “Delete”).

Do not put a trash or archive icon on a resting row. Destructive actions live in an overflow menu (`MoreHorizontal`), then a confirm, then an undo toast.

## Motion

120–160ms, ease-out, opacity and color only. No layout bounce. Overlays may use `--sh-pop`. Respect `prefers-reduced-motion: reduce` by disabling transform and the tables spinner (already done for `.cw-tables-spin`). Do not animate a row because it is overdue.

## Voice and tone

Short, specific, and calm. Say what happened and what the person can do next.

| Do | Don't |
| --- | --- |
| “Moved to Deleted. Undo for 10 seconds. Restorable for 30 days.” | “Successfully deleted!” |
| “No items due today.” | “You're all caught up! 🎉” |
| “Tags are labels. Client and Delivery Entity are separate.” | “Oops, something went wrong.” |
| “Couldn't load tables. Membership allows this workspace, but a private table blocked the list. Retry.” | “Missing or insufficient permissions.” |

One language per user. Every new string goes through `t()` in `src/lib/i18n.ts` for both `en` and `es`. No hardcoded “Agregar”, “Rutinas”, or “Ver flujo” in a component. The locale is a Settings choice, stored on the user, and it wins over `navigator.language`.

Ids are secondary: “Annual plan” with a copyable `ACME-14` in mono, never the Firestore id as the title.

Numbers that disagree must say why: “6 open in this view · 33 including archived.”

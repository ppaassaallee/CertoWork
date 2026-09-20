# Daily Plan visual reference

Handed mockups for Steps **6, 7, 9, 13, 17, 24**. CSS class / data-bucket tokens match the product:

| Bucket | Token | Color |
|--------|-------|-------|
| Growth | `growth` | blue `#2547C4` |
| Fires | `fire` | orange `#F2620F` |
| Extras | `extra` | gray `#424242` |

Semáforo dots on cards stay **red / yellow / green** — never reused for buckets.

## Files

- [`mockup-desktop.html`](./mockup-desktop.html) — three columns: My items (leftovers + hover `+ Today`) · Today board under week strip · Events with dashed unsynced time block. Clickable: `+ Today`, checkboxes, Plan my day → proposal sheet, Close the day → close ritual.
- [`mockup-mobile.html`](./mockup-mobile.html) — same content as tabs **My items / Today / Events**, with `Plan today · 5 min` empty state on the list. Phone-sized.

Product styles live in `src/features/dailyPlan/dailyPlan.css` (`--dp-fire`, `--dp-growth`, `--dp-extra`, `.dp-bucket[data-bucket=…]`).

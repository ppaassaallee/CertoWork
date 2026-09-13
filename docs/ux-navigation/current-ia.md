# Current information architecture (audit)

Audit date: 2026-09-13  
Live shell: `DelivereeWorkspace` via `App.tsx` catch-all `path="*"`.

## Primary navigation (sidebar philosophy)

Essentials stay short and flat. Secondary destinations collapse under **Management**. One AI noun in the rail: **Rutinas** (`/rutinas`; `/agents` still resolves).

```
Search (⌘K)
Essentials
  Home → /home
  My Work → /my-work
  Projects → /projects
  Notes → /notes
  Approvals → /approvals
  Rutinas → /rutinas
Projects (favorites / recent)
Management ▾ (collapsed by default)
  Requests → /requests
  Invoices → /invoices
  SupportOps → /supportops
Conversations (+ new / search)
Account → Workspace & team / Settings / Sign out
```

## Look and feel

- Quiet active: surface highlight + soft shadow (no accent bar, no loud tint).
- Section headers carry actions (+ / search), not mid-rail CTAs.
- Color reserved for project health / badges, not every selected row.

## Live resolver

`src/lib/delivereeRoutes.ts` maps legacy URLs into lenses. Many modules listed in `CAPABILITY_LEDGER.md` are preserved as data/routes but not mounted as separate apps.

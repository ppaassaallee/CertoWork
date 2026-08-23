# Current information architecture (audit)

Audit date: 2026-08-23  
Live shell: `DelivereeWorkspace` via `App.tsx` catch-all `path="*"`.

## Primary navigation (as shipped before this refactor)

```
Home → /home
Work → /work                    (Project Command Center)
Approvals → /approvals
Settings → /settings
More ▾
  Automations → /more/automations
  Updates → /more/updates
  Workspace & team → /more/workspace
[New conversation]
[Odysseus hire card]
Projects (favorites / recent) · Command center
Conversations (expanding list)
Account → Workspace & team / Settings / Sign out
```

## Problems

- Work, Projects, and Command Center compete for the same job.
- Odysseus sits beside primary nav as a parallel product concept.
- More hides Automations / Updates / Workspace without a user job.
- Conversations compete with Projects as a second file tree.
- Settings is treated as a daily destination.
- Capture / Action Board / Intake vocabulary leaks into navigation.

## Live resolver

`src/lib/delivereeRoutes.ts` maps legacy URLs into lenses. Many modules listed in `CAPABILITY_LEDGER.md` are preserved as data/routes but not mounted as separate apps.

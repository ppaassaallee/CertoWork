# Certo Run validation ledger

2026-11-05. This is an honest coverage inventory, not a completion certificate.

Update: the user subsequently supplied the v2 golden archive: 125 screenshots, a 3,113-control inventory and fixture. The uncompiled AI Studio UI remains absent. Live import, real tokens, cloud permission changes and production test data were not authorized by the reference prompts and were not performed.

The current module uses one Certo document and tasks with runWorld. The supplied spec instead requires an isolated Run entry and a workspace per world. Those contracts conflict with existing tests and docs/run/DECISIONS.md. This review does not silently migrate existing records or change workspace membership.

## Coverage matrix

No full PBI is marked PASS based on partial unit tests. FAIL means a proven contract mismatch. MISSING means the required implementation/evidence is absent. BLOCKED means supplied acceptance evidence or external test infrastructure is unavailable. Parent rows roll up their children.

| ID | Type | Status | Scope | Evidence / next check |
|---|---|---|---|---|
| RUN-0 | epic | MISSING | E0 Module foundation | Required acceptance test not implemented; no full completion claim. |
| RUN-0.1 | feature | FAIL | F0.1 Module shell and routing | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.1.1 | pbi | FAIL | Add the commandRun feature flag | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.1.1.T1 | task | FAIL | Write the MCP contract test against the local Worker for "Add the commandRun feature flag" | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.1.1.T2 | task | FAIL | Build or confirm: Flag `commandRun` in `featureFlags.ts`, default off, resolvable per tenant, workspace and user | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.1.1.T3 | task | FAIL | Record the evidence | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.1.2 | pbi | FAIL | Serve the Run bundle from the same Worker | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.1.2.T1 | task | FAIL | Write the MCP contract test against the local Worker for "Serve the Run bundle from the same Worker" | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.1.2.T2 | task | FAIL | Build or confirm: Second Vite entry `run.html` built into `dist/run/`; Worker serves it at `/run/*` with SPA fallback | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.1.2.T3 | task | FAIL | Record the evidence | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.1.3 | pbi | FAIL | Add the Run entry to Certo navigation | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.1.3.T1 | task | FAIL | Write the MCP contract test against the local Worker for "Add the Run entry to Certo navigation" | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.1.3.T2 | task | FAIL | Build or confirm: One nav item "Run" with the open-items count of the active world | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.1.3.T3 | task | FAIL | Record the evidence | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.2 | feature | MISSING | F0.2 Shared services adapter | Required acceptance test not implemented; no full completion claim. |
| RUN-0.2.1 | pbi | FAIL | Create the RunStore adapter over Certo services | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.2.1.T1 | task | FAIL | Write the MCP contract test against the local Worker for "Create the RunStore adapter over Certo services" | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.2.1.T2 | task | FAIL | Build or confirm: `src/run/data/RunStore.tsx` exposing the exact API of the AI Studio `store.tsx` (setWorld, setOutcome, moveToMake, saveAllocation, …) backed by Firestore doc stores and Worker routes | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.2.1.T3 | task | FAIL | Record the evidence | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-0.2.2 | pbi | MISSING | Port the domain rules | Required acceptance test not implemented; no full completion claim. |
| RUN-0.2.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Port the domain rules" | Required acceptance test not implemented; no full completion claim. |
| RUN-0.2.2.T2 | task | MISSING | Build or confirm: `src/run/domain/` from the AI Studio `packages/domain` (queues, caps, dayplan, allocation, intake, texts, manifesto, vocab, dates, schemas) with its tests | Required acceptance test not implemented; no full completion claim. |
| RUN-0.2.2.T3 | task | MISSING | Prove the agent path: The same rules run in the Worker for agent writes, so Grok, muse and dots get the same results as the UI | Required acceptance test not implemented; no full completion claim. |
| RUN-0.2.2.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-1 | epic | MISSING | E1 UX parity with the AI Studio build | Required acceptance test not implemented; no full completion claim. |
| RUN-1.1 | feature | FAIL | F1.1 Isolated styling | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.1 | pbi | FAIL | Build Run with its own Tailwind v4 pipeline | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.1.T1 | task | FAIL | Write the Playwright visual test for "Build Run with its own Tailwind v4 pipeline" | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.1.T2 | task | FAIL | Build or confirm: Tailwind v4 + `@tailwindcss/vite` only in the Run entry; `tokens.css` copied verbatim | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.1.T3 | task | FAIL | Match the golden screens and controls it touches | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.1.T4 | task | FAIL | Record the evidence | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.2 | pbi | FAIL | Copy the AI Studio UI verbatim | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.2.T1 | task | FAIL | Write the MCP contract test against the local Worker for "Copy the AI Studio UI verbatim" | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.2.T2 | task | FAIL | Build or confirm: `src/run/ui/*` and `src/run/views/*` copied file for file from the AI Studio export; only imports change | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.2.T3 | task | FAIL | Match the golden screens and controls it touches | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.2.T4 | task | FAIL | Record the evidence | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.3 | pbi | FAIL | Load the three fonts once | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.3.T1 | task | FAIL | Write the Playwright visual test for "Load the three fonts once" | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.3.T2 | task | FAIL | Build or confirm: Familjen Grotesk 600/700, Atkinson Hyperlegible 400/700, JetBrains Mono 400/500/600, `display=swap` | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.3.T3 | task | FAIL | Match the golden screens and controls it touches | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.1.3.T4 | task | FAIL | Record the evidence | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2 | feature | FAIL | F1.2 Visual and interaction regression gate | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.1 | pbi | FAIL | Add the golden screenshots as baselines | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.1.T1 | task | FAIL | Write the Playwright visual test for "Add the golden screenshots as baselines" | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.1.T2 | task | FAIL | Build or confirm: `tests/run-visual/golden/{desktop,phone}/*.png` from the AI Studio build | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.1.T3 | task | FAIL | Prove the agent path: A fixture workspace is filled through MCP calls (create_item, record_brief…) before the screenshots, so the agent write path is part of the visual test | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.1.T4 | task | FAIL | Match the golden screens and controls it touches | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.1.T5 | task | FAIL | Record the evidence | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.2 | pbi | FAIL | Add the interaction inventory test | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.2.T1 | task | FAIL | Write the Playwright visual test for "Add the interaction inventory test" | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.2.T2 | task | FAIL | Build or confirm: `tests/run-visual/interaction-inventory.json` (1,941 controls); test reads computed styles per screen | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.2.T3 | task | FAIL | Match the golden screens and controls it touches | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.2.T4 | task | FAIL | Record the evidence | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.3 | pbi | FAIL | Define the missing fade-in animation | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.3.T1 | task | FAIL | Write the Playwright visual test for "Define the missing fade-in animation" | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.3.T2 | task | FAIL | Build or confirm: `@keyframes fade-in` (opacity 0→1, translateY 4px→0, 150 ms ease-out) used by toast, menus and flags; `prefers-reduced-motion` disables it | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.3.T3 | task | FAIL | Match the golden screens and controls it touches | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.2.3.T4 | task | FAIL | Record the evidence | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3 | feature | FAIL | F1.3 States and responsive rules | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.1 | pbi | FAIL | Design empty states for an empty install | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.1.T1 | task | FAIL | Write the MCP contract test against the local Worker for "Design empty states for an empty install" | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.1.T2 | task | FAIL | Build or confirm: One sentence and one action per screen ("Nothing here yet. Your agent fills this from your sources." + Open agent setup) | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.1.T3 | task | FAIL | Prove the agent path: The action opens Settings → Agents with the Grok, muse and dots setup packs | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.1.T4 | task | FAIL | Match the golden screens and controls it touches | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.1.T5 | task | FAIL | Record the evidence | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.2 | pbi | FAIL | Hide record ids on screen | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.2.T1 | task | FAIL | Write the MCP contract test against the local Worker for "Hide record ids on screen" | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.2.T2 | task | FAIL | Build or confirm: Ids only inside "Context and origin" | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.2.T3 | task | FAIL | Match the golden screens and controls it touches | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.2.T4 | task | FAIL | Record the evidence | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.3 | pbi | FAIL | Phone layout pass | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.3.T1 | task | FAIL | Write the Playwright visual test for "Phone layout pass" | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.3.T2 | task | FAIL | Build or confirm: Single column under 620 px; only pipeline and week grids scroll sideways | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.3.T3 | task | FAIL | Match the golden screens and controls it touches | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-1.3.3.T4 | task | FAIL | Record the evidence | V2 baseline received: 125 PNGs and 3,113 controls. Partial comparisons FAIL at ~3%; remaining screen tests and source UI parity are not implemented. |
| RUN-2 | epic | MISSING | E2 Worlds on Certo workspaces | Required acceptance test not implemented; no full completion claim. |
| RUN-2.1 | feature | FAIL | F2.1 World workspaces | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.1.1 | pbi | FAIL | Mark workspaces as worlds | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.1.1.T1 | task | FAIL | Write the Firestore rules test on the emulator for "Mark workspaces as worlds" | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.1.1.T2 | task | FAIL | Build or confirm: Fields `world`, `color`, `kind` (shared or private) on `workspaces`; Personal auto-created per user | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.1.1.T3 | task | FAIL | Prove the agent path: `list_workspaces` returns `world`, `kind` and `color` so agents know which world they write to | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.1.1.T4 | task | FAIL | Match the golden screens and controls it touches | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.1.1.T5 | task | FAIL | Record the evidence | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.1.2 | pbi | FAIL | World switch in the Run top bar | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.1.2.T1 | task | FAIL | Write the MCP contract test against the local Worker for "World switch in the Run top bar" | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.1.2.T2 | task | FAIL | Build or confirm: Pills with open counts; the switch sets Certo's active workspace | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.1.2.T3 | task | FAIL | Match the golden screens and controls it touches | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.1.2.T4 | task | FAIL | Record the evidence | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2 | feature | FAIL | F2.2 Isolation | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.1 | pbi | FAIL | Enforce private-world rules | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.1.T1 | task | FAIL | Write the Firestore rules test on the emulator for "Enforce private-world rules" | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.1.T2 | task | FAIL | Build or confirm: Private workspace readable only by its owner uid | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.1.T3 | task | FAIL | Prove the agent path: An agent token can read Personal only if the token belongs to that user and has the `life` scope | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.1.T4 | task | FAIL | Match the golden screens and controls it touches | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.1.T5 | task | FAIL | Record the evidence | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.2 | pbi | FAIL | Isolation tests for Run collections and MCP | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.2.T1 | task | FAIL | Write the MCP contract test against the local Worker for "Isolation tests for Run collections and MCP" | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.2.T2 | task | FAIL | Build or confirm: Cross-workspace reads on every `run_*` collection and every Run tool must fail | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.2.T3 | task | FAIL | Prove the agent path: Each Run MCP tool has a test that calls it with a token of another world and expects 403 | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.2.T4 | task | FAIL | Match the golden screens and controls it touches | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.2.T5 | task | FAIL | Record the evidence | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.3 | pbi | FAIL | Fix the Team leak seen in the AI Studio build | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.3.T1 | task | FAIL | Write the MCP contract test against the local Worker for "Fix the Team leak seen in the AI Studio build" | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.3.T2 | task | FAIL | Build or confirm: Team, Projects, Week, Close filter by the active workspace | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.3.T3 | task | FAIL | Match the golden screens and controls it touches | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-2.2.3.T4 | task | FAIL | Record the evidence | Existing one-document/world-field design differs from supplied acceptance contract; RunStore mutations remain placeholders. |
| RUN-3 | epic | MISSING | E3 Item standard on Certo tasks | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1 | feature | MISSING | F3.1 Fields and validation | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.1 | pbi | MISSING | Add lane and decision to tasks | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Add lane and decision to tasks" | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.1.T2 | task | MISSING | Build or confirm: `lane`, `decision` on `Task`, route schemas and `list_fields` | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.1.T3 | task | MISSING | Prove the agent path: `list_fields` returns the enums; a refusal returns them too | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.1.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.1.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.2 | pbi | MISSING | Add the five description fields | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Add the five description fields" | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.2.T2 | task | MISSING | Build or confirm: `context`, `deliverable`, `doneWhen`, `nextStep`, `source` editable in Certo's item modal | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.2.T3 | task | MISSING | Prove the agent path: Agents fill all five; `source` carries channel, thread id and date | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.2.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.2.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.3 | pbi | MISSING | Title and gate validator | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.3.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Title and gate validator" | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.3.T2 | task | MISSING | Build or confirm: Verb first, ≤ 12 words, no dates or channel words; admin never make | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.3.T3 | task | MISSING | Prove the agent path: An agent title that fails comes back with the rule; Grok rewrites and retries once, then tags `needs-info` | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.3.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-3.1.3.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2 | feature | MISSING | F3.2 Empty start and readiness | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.1 | pbi | MISSING | Start empty, no seed data | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Start empty, no seed data" | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.1.T2 | task | MISSING | Build or confirm: No items, people, allocations, promises, life data or tokens are created by code | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.1.T3 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.1.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.2 | pbi | MISSING | Add get_readiness to MCP | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Add get_readiness to MCP" | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.2.T2 | task | MISSING | Build or confirm: Returns worlds, missing tools, vocabularies, scopes, caps, day template and `ok` | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.2.T3 | task | MISSING | Prove the agent path: First call of the Grok fill prompt; muse and dots use the same call before writing | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.2.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.2.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.3 | pbi | MISSING | Owner mapping | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.3.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Owner mapping" | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.3.T2 | task | MISSING | Build or confirm: Owner names map to `assigneeId` when a member matches, else stay as text | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.3.T3 | task | MISSING | Prove the agent path: Agents pass owner names as text; the Worker maps them | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.3.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-3.2.3.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-4 | epic | MISSING | E4 Queues and caps | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1 | feature | MISSING | F4.1 Queue view | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.1 | pbi | MISSING | Queue route with five segments | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.1.T1 | task | MISSING | Write the unit or component test for "Queue route with five segments" | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.1.T2 | task | MISSING | Build or confirm: Make, Decide, Owed, Admin, Delegated with counts from one hook | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.1.T3 | task | MISSING | Prove the agent path: `list_queue` returns the same lists in compact form | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.1.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.1.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.2 | pbi | MISSING | Item card with inline actions | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Item card with inline actions" | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.2.T2 | task | MISSING | Build or confirm: Done, Delegate, Renegotiate, Drop (reason), undo toast 8 s | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.2.T3 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.2.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.3 | pbi | MISSING | Make: five slots and ordered queue | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.3.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Make: five slots and ordered queue" | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.3.T2 | task | MISSING | Build or confirm: Five in progress, the rest with Move up | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.3.T3 | task | MISSING | Prove the agent path: Agents can propose a reorder; only the person moves an item into the five | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.3.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-4.1.3.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2 | feature | MISSING | F4.2 Decide | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.1 | pbi | MISSING | Decide deck with keyboard | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Decide deck with keyboard" | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.1.T2 | task | MISSING | Build or confirm: One card at a time; Y, N, D, X, → | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.1.T3 | task | MISSING | Prove the agent path: Grok reads answers at 17:47 to run next steps | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.1.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.1.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.2 | pbi | MISSING | Agent proposals in the deck | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Agent proposals in the deck" | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.2.T2 | task | MISSING | Build or confirm: `review_candidates` from agents shown as cards with agent name and reasoning | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.2.T3 | task | MISSING | Prove the agent path: Proposals come from Grok, muse or dots via `propose_decision`; the card names the agent | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.2.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.2.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.3 | pbi | MISSING | World questions for split clients | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.3.T1 | task | MISSING | Write the MCP contract test against the local Worker for "World questions for split clients" | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.3.T2 | task | MISSING | Build or confirm: Cementos Progreso, Credichapin, Klap, Menzis, PYP, Tecalis asked per world | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.3.T3 | task | MISSING | Prove the agent path: Agents never guess a split client's world; they create a world question | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.3.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-4.2.3.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3 | feature | MISSING | F4.3 Owed, delegated and caps | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.1 | pbi | MISSING | Owed to me grouped by person | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Owed to me grouped by person" | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.1.T2 | task | MISSING | Build or confirm: Oldest first, Copy reminder, It arrived, No longer applies | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.1.T3 | task | MISSING | Prove the agent path: Grok drafts the chase messages; nothing is sent | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.1.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.1.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.2 | pbi | MISSING | Delegation with captain mode and context | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Delegation with captain mode and context" | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.2.T2 | task | MISSING | Build or confirm: Who, date, captain or propose, context | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.2.T3 | task | MISSING | Prove the agent path: Grok drafts the context brief for the owner when it is empty | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.2.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.2.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.3 | pbi | MISSING | Enforce caps in the Worker | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.3.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Enforce caps in the Worker" | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.3.T2 | task | MISSING | Build or confirm: 5 Make, 10 P1, 15 admin, 3 tomorrow; `409 cap_exceeded` with the list | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.3.T3 | task | MISSING | Prove the agent path: Same refusal for agents | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.3.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.3.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.4 | pbi | MISSING | Admin SLA and batch hand-off | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.4.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Admin SLA and batch hand-off" | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.4.T2 | task | MISSING | Build or confirm: 72-hour ageing; hand the whole batch to one person | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.4.T3 | task | MISSING | Prove the agent path: Grok proposes the batch hand-off when admin passes 15 | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.4.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-4.3.4.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-5 | epic | MISSING | E5 Today | Required acceptance test not implemented; no full completion claim. |
| RUN-5.1 | feature | MISSING | F5.1 Day plan | Required acceptance test not implemented; no full completion claim. |
| RUN-5.1.1 | pbi | MISSING | Day plan service with world-tagged blocks | Required acceptance test not implemented; no full completion claim. |
| RUN-5.1.1.T1 | task | MISSING | Write the Playwright visual test for "Day plan service with world-tagged blocks" | Required acceptance test not implemented; no full completion claim. |
| RUN-5.1.1.T2 | task | MISSING | Build or confirm: `dayPlan(date, world)` from `run_settings` | Required acceptance test not implemented; no full completion claim. |
| RUN-5.1.1.T3 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-5.1.1.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-5.1.2 | pbi | MISSING | Real meetings inside the meetings block | Required acceptance test not implemented; no full completion claim. |
| RUN-5.1.2.T1 | task | MISSING | Write the Firestore rules test on the emulator for "Real meetings inside the meetings block" | Required acceptance test not implemented; no full completion claim. |
| RUN-5.1.2.T2 | task | MISSING | Build or confirm: Google Calendar events of the world | Required acceptance test not implemented; no full completion claim. |
| RUN-5.1.2.T3 | task | MISSING | Prove the agent path: Agents can read the day through `list_queue` + calendar; they never create events without approval | Required acceptance test not implemented; no full completion claim. |
| RUN-5.1.2.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-5.1.2.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2 | feature | MISSING | F5.2 Rail and panels | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.1 | pbi | MISSING | Rail with muted other-world blocks | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Rail with muted other-world blocks" | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.1.T2 | task | MISSING | Build or confirm: Muted and unclickable | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.1.T3 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.1.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.2 | pbi | MISSING | One panel per block kind | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.2.T1 | task | MISSING | Write the Playwright visual test for "One panel per block kind" | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.2.T2 | task | MISSING | Build or confirm: Brief, Make, Admin, Meetings, Family, Afternoon, Weekly review, Close, Workout, Wake-up, Evening | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.2.T3 | task | MISSING | Prove the agent path: Brief panel shows the agent's ten decisions | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.2.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.2.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.3 | pbi | MISSING | Score strip and now chip | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.3.T1 | task | MISSING | Write the unit or component test for "Score strip and now chip" | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.3.T2 | task | MISSING | Build or confirm: Five tiles per world kind; current or next block | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.3.T3 | task | MISSING | Prove the agent path: `get_caps` returns the same five numbers | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.3.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-5.2.3.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-6 | epic | MISSING | E6 Manifesto, check-in and focus | Required acceptance test not implemented; no full completion claim. |
| RUN-6.1 | feature | MISSING | F6.1 Manifesto | Required acceptance test not implemented; no full completion claim. |
| RUN-6.1.1 | pbi | MISSING | Manifesto overlay with versions | Required acceptance test not implemented; no full completion claim. |
| RUN-6.1.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Manifesto overlay with versions" | Required acceptance test not implemented; no full completion claim. |
| RUN-6.1.1.T2 | task | MISSING | Build or confirm: `run_manifesto/{uid}` with history and restore | Required acceptance test not implemented; no full completion claim. |
| RUN-6.1.1.T3 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-6.1.1.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-6.2 | feature | MISSING | F6.2 Check-in and flag | Required acceptance test not implemented; no full completion claim. |
| RUN-6.2.1 | pbi | MISSING | Check-in with five states | Required acceptance test not implemented; no full completion claim. |
| RUN-6.2.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Check-in with five states" | Required acceptance test not implemented; no full completion claim. |
| RUN-6.2.1.T2 | task | MISSING | Build or confirm: Sleep hours and one of five states with resets | Required acceptance test not implemented; no full completion claim. |
| RUN-6.2.1.T3 | task | MISSING | Prove the agent path: `record_checkin` lets a voice agent log it | Required acceptance test not implemented; no full completion claim. |
| RUN-6.2.1.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-6.2.1.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-6.2.2 | pbi | MISSING | No-irreversible day flag | Required acceptance test not implemented; no full completion claim. |
| RUN-6.2.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "No-irreversible day flag" | Required acceptance test not implemented; no full completion claim. |
| RUN-6.2.2.T2 | task | MISSING | Build or confirm: Under 6 h flags sign, final price, exit, drop P1 | Required acceptance test not implemented; no full completion claim. |
| RUN-6.2.2.T3 | task | MISSING | Prove the agent path: On a flagged day Grok marks irreversible proposals as "move to tomorrow" | Required acceptance test not implemented; no full completion claim. |
| RUN-6.2.2.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-6.2.2.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-6.3 | feature | MISSING | F6.3 Focus | Required acceptance test not implemented; no full completion claim. |
| RUN-6.3.1 | pbi | MISSING | Focus block with wake lock | Required acceptance test not implemented; no full completion claim. |
| RUN-6.3.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Focus block with wake lock" | Required acceptance test not implemented; no full completion claim. |
| RUN-6.3.1.T2 | task | MISSING | Build or confirm: 25 or 50 min; Done, Continue, Stuck | Required acceptance test not implemented; no full completion claim. |
| RUN-6.3.1.T3 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-6.3.1.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-7 | epic | MISSING | E7 Intake and close | Required acceptance test not implemented; no full completion claim. |
| RUN-7.1 | feature | MISSING | F7.1 Intake | Required acceptance test not implemented; no full completion claim. |
| RUN-7.1.1 | pbi | MISSING | Five-question gate | Required acceptance test not implemented; no full completion claim. |
| RUN-7.1.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Five-question gate" | Required acceptance test not implemented; no full completion claim. |
| RUN-7.1.1.T2 | task | MISSING | Build or confirm: Destination on the first No | Required acceptance test not implemented; no full completion claim. |
| RUN-7.1.1.T3 | task | MISSING | Prove the agent path: `create_item` with `gate` answers; a No returns the destination and the agent files a note or comment | Required acceptance test not implemented; no full completion claim. |
| RUN-7.1.1.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-7.1.1.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-7.1.2 | pbi | MISSING | PBI form with live standard | Required acceptance test not implemented; no full completion claim. |
| RUN-7.1.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "PBI form with live standard" | Required acceptance test not implemented; no full completion claim. |
| RUN-7.1.2.T2 | task | MISSING | Build or confirm: Client, lane, decision, title counter, five fields, preview | Required acceptance test not implemented; no full completion claim. |
| RUN-7.1.2.T3 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-7.1.2.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-7.2 | feature | MISSING | F7.2 Close | Required acceptance test not implemented; no full completion claim. |
| RUN-7.2.1 | pbi | MISSING | Daily close per world | Required acceptance test not implemented; no full completion claim. |
| RUN-7.2.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Daily close per world" | Required acceptance test not implemented; no full completion claim. |
| RUN-7.2.1.T2 | task | MISSING | Build or confirm: Resolved vs came in, promises, three for tomorrow, hand-off | Required acceptance test not implemented; no full completion claim. |
| RUN-7.2.1.T3 | task | MISSING | Prove the agent path: `get_close` lets Grok read it at 17:47 | Required acceptance test not implemented; no full completion claim. |
| RUN-7.2.1.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-7.2.1.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-7.2.2 | pbi | MISSING | Personal close | Required acceptance test not implemented; no full completion claim. |
| RUN-7.2.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Personal close" | Required acceptance test not implemented; no full completion claim. |
| RUN-7.2.2.T2 | task | MISSING | Build or confirm: Check-in summary and one person for tomorrow | Required acceptance test not implemented; no full completion claim. |
| RUN-7.2.2.T3 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-7.2.2.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-8 | epic | MISSING | E8 Projects | Required acceptance test not implemented; no full completion claim. |
| RUN-8.1 | feature | MISSING | F8.1 Pipeline and delivery | Required acceptance test not implemented; no full completion claim. |
| RUN-8.1.1 | pbi | MISSING | Pipeline board from commercial epics | Required acceptance test not implemented; no full completion claim. |
| RUN-8.1.1.T1 | task | MISSING | Write the unit or component test for "Pipeline board from commercial epics" | Required acceptance test not implemented; no full completion claim. |
| RUN-8.1.1.T2 | task | MISSING | Build or confirm: Four stages, next step per opportunity | Required acceptance test not implemented; no full completion claim. |
| RUN-8.1.1.T3 | task | MISSING | Prove the agent path: `get_projects` returns stage and next step; `set_pipeline_stage` is a proposal | Required acceptance test not implemented; no full completion claim. |
| RUN-8.1.1.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-8.1.1.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-8.1.2 | pbi | MISSING | Traffic lights on project health | Required acceptance test not implemented; no full completion claim. |
| RUN-8.1.2.T1 | task | MISSING | Write the unit or component test for "Traffic lights on project health" | Required acceptance test not implemented; no full completion claim. |
| RUN-8.1.2.T2 | task | MISSING | Build or confirm: Green/amber/red on `projects.health`, unblock note | Required acceptance test not implemented; no full completion claim. |
| RUN-8.1.2.T3 | task | MISSING | Prove the agent path: `set_health` as a proposal with the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-8.1.2.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-8.1.2.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-8.2 | feature | MISSING | F8.2 Portfolio | Required acceptance test not implemented; no full completion claim. |
| RUN-8.2.1 | pbi | MISSING | Project sheet | Required acceptance test not implemented; no full completion claim. |
| RUN-8.2.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Project sheet" | Required acceptance test not implemented; no full completion claim. |
| RUN-8.2.1.T2 | task | MISSING | Build or confirm: `run_sheets`: team, pricing model, revenue, currency, target margin | Required acceptance test not implemented; no full completion claim. |
| RUN-8.2.1.T3 | task | MISSING | Prove the agent path: Read-only for agents | Required acceptance test not implemented; no full completion claim. |
| RUN-8.2.1.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-8.2.1.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-8.2.2 | pbi | MISSING | Billing lines on Certo invoices | Required acceptance test not implemented; no full completion claim. |
| RUN-8.2.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Billing lines on Certo invoices" | Required acceptance test not implemented; no full completion claim. |
| RUN-8.2.2.T2 | task | MISSING | Build or confirm: Lines as `invoice_documents` linked to the project | Required acceptance test not implemented; no full completion claim. |
| RUN-8.2.2.T3 | task | MISSING | Prove the agent path: Agents can read overdue lines to draft reminders | Required acceptance test not implemented; no full completion claim. |
| RUN-8.2.2.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-8.2.2.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-9 | epic | MISSING | E9 Team | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1 | feature | MISSING | F9.1 Allocation and utilization | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.1 | pbi | MISSING | Allocation matrix | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.1.T1 | task | MISSING | Write the unit or component test for "Allocation matrix" | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.1.T2 | task | MISSING | Build or confirm: `run_allocations/{workspace}_{week}`; 100 % = 170 h/month | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.1.T3 | task | MISSING | Prove the agent path: `set_allocation` refused over 100 % with the person's rows | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.1.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.1.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.2 | pbi | MISSING | Copy and repeat weeks | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Copy and repeat weeks" | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.2.T2 | task | MISSING | Build or confirm: Copy last week; repeat into 3 empty weeks | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.2.T3 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.2.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.3 | pbi | MISSING | Utilization grid | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.3.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Utilization grid" | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.3.T2 | task | MISSING | Build or confirm: 8 weeks, 2 months by working day | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.3.T3 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-9.1.3.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-9.2 | feature | MISSING | F9.2 How I lead | Required acceptance test not implemented; no full completion claim. |
| RUN-9.2.1 | pbi | MISSING | Keeper test and 4A feedback | Required acceptance test not implemented; no full completion claim. |
| RUN-9.2.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Keeper test and 4A feedback" | Required acceptance test not implemented; no full completion claim. |
| RUN-9.2.1.T2 | task | MISSING | Build or confirm: `run_people` keeper, dates, what is due | Required acceptance test not implemented; no full completion claim. |
| RUN-9.2.1.T3 | task | MISSING | Prove the agent path: Keeper answers are excluded from every MCP response | Required acceptance test not implemented; no full completion claim. |
| RUN-9.2.1.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-9.2.1.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-9.2.2 | pbi | MISSING | Lucy text for the team | Required acceptance test not implemented; no full completion claim. |
| RUN-9.2.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Lucy text for the team" | Required acceptance test not implemented; no full completion claim. |
| RUN-9.2.2.T2 | task | MISSING | Build or confirm: Allocations, alerts, feedback slots as drafts | Required acceptance test not implemented; no full completion claim. |
| RUN-9.2.2.T3 | task | MISSING | Prove the agent path: Grok creates the feedback slots as calendar drafts | Required acceptance test not implemented; no full completion claim. |
| RUN-9.2.2.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-9.2.2.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-10 | epic | MISSING | E10 Week | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1 | feature | MISSING | F10.1 Week grid | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.1 | pbi | MISSING | Week grid with fronts | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Week grid with fronts" | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.1.T2 | task | MISSING | Build or confirm: Mornings, admin, afternoons; claim or give away mornings | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.1.T3 | task | MISSING | Prove the agent path: `get_week_plan` for agents | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.1.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.1.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.2 | pbi | MISSING | 60/25/15 meter | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.2.T1 | task | MISSING | Write the Playwright visual test for "60/25/15 meter" | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.2.T2 | task | MISSING | Build or confirm: Share of assigned hours | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.2.T3 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.2.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.3 | pbi | MISSING | Calendar drafts | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.3.T1 | task | MISSING | Write the unit or component test for "Calendar drafts" | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.3.T2 | task | MISSING | Build or confirm: Tentative events in the world calendar | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.3.T3 | task | MISSING | Prove the agent path: Proposals in Decide | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.3.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-10.1.3.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-11 | epic | MISSING | E11 Life | Required acceptance test not implemented; no full completion claim. |
| RUN-11.1 | feature | MISSING | F11.1 Check-in and body | Required acceptance test not implemented; no full completion claim. |
| RUN-11.1.1 | pbi | MISSING | Twenty-second check-in | Required acceptance test not implemented; no full completion claim. |
| RUN-11.1.1.T1 | task | MISSING | Write the unit or component test for "Twenty-second check-in" | Required acceptance test not implemented; no full completion claim. |
| RUN-11.1.1.T2 | task | MISSING | Build or confirm: Sleep, trained, worked late | Required acceptance test not implemented; no full completion claim. |
| RUN-11.1.1.T3 | task | MISSING | Prove the agent path: `record_checkin` | Required acceptance test not implemented; no full completion claim. |
| RUN-11.1.1.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-11.1.1.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-11.1.2 | pbi | MISSING | Body week on Certo workouts | Required acceptance test not implemented; no full completion claim. |
| RUN-11.1.2.T1 | task | MISSING | Write the unit or component test for "Body week on Certo workouts" | Required acceptance test not implemented; no full completion claim. |
| RUN-11.1.2.T2 | task | MISSING | Build or confirm: Seven-day grid from the plan | Required acceptance test not implemented; no full completion claim. |
| RUN-11.1.2.T3 | task | MISSING | Prove the agent path: Micah (Gemini) reads it through `get_life(body)` | Required acceptance test not implemented; no full completion claim. |
| RUN-11.1.2.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-11.1.2.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2 | feature | MISSING | F11.2 People, reading, pending | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.1 | pbi | MISSING | People cards with rhythm | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.1.T1 | task | MISSING | Write the unit or component test for "People cards with rhythm" | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.1.T2 | task | MISSING | Build or confirm: Relation, rhythm, last time, next thing, We did it | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.1.T3 | task | MISSING | Prove the agent path: Lucy proposes slots for people past their rhythm | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.1.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.1.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.2 | pbi | MISSING | One book at a time | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "One book at a time" | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.2.T2 | task | MISSING | Build or confirm: Next, reading, done with one takeaway | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.2.T3 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.2.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.3 | pbi | MISSING | Personal pending and agent texts | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.3.T1 | task | MISSING | Write the unit or component test for "Personal pending and agent texts" | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.3.T2 | task | MISSING | Build or confirm: Pending items; texts for Lucy and Micah | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.3.T3 | task | MISSING | Prove the agent path: Copy texts or `get_life` | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.3.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-11.2.3.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-12 | epic | MISSING | E12 Agents: one contract for Grok bot, muse, dots and any MCP client | Required acceptance test not implemented; no full completion claim. |
| RUN-12.1 | feature | MISSING | F12.1 Run tools on Certo MCP | Required acceptance test not implemented; no full completion claim. |
| RUN-12.1.1 | pbi | MISSING | Add the Run tools | Required acceptance test not implemented; no full completion claim. |
| RUN-12.1.1.T1 | task | MISSING | Write the Firestore rules test on the emulator for "Add the Run tools" | Required acceptance test not implemented; no full completion claim. |
| RUN-12.1.1.T2 | task | MISSING | Build or confirm: get_readiness, list_queue, get_caps, propose_decision, record_brief, get_close, get_projects, set_pipeline_stage, set_health, get_allocation, set_allocation, get_week_plan, record_checkin, get_life | Required acceptance test not implemented; no full completion claim. |
| RUN-12.1.1.T3 | task | MISSING | Prove the agent path: All agents | Required acceptance test not implemented; no full completion claim. |
| RUN-12.1.1.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-12.1.2 | pbi | MISSING | Compact responses | Required acceptance test not implemented; no full completion claim. |
| RUN-12.1.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Compact responses" | Required acceptance test not implemented; no full completion claim. |
| RUN-12.1.2.T2 | task | MISSING | Build or confirm: `fields`, `since`, page 50, max 200 | Required acceptance test not implemented; no full completion claim. |
| RUN-12.1.2.T3 | task | MISSING | Prove the agent path: Lower token cost for every agent | Required acceptance test not implemented; no full completion claim. |
| RUN-12.1.2.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-12.2 | feature | MISSING | F12.2 Propose scope and audit | Required acceptance test not implemented; no full completion claim. |
| RUN-12.2.1 | pbi | MISSING | Propose as default scope | Required acceptance test not implemented; no full completion claim. |
| RUN-12.2.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Propose as default scope" | Required acceptance test not implemented; no full completion claim. |
| RUN-12.2.1.T2 | task | MISSING | Build or confirm: Mutations become `review_candidates` | Required acceptance test not implemented; no full completion claim. |
| RUN-12.2.1.T3 | task | MISSING | Prove the agent path: Grok, muse, dots | Required acceptance test not implemented; no full completion claim. |
| RUN-12.2.1.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-12.2.2 | pbi | MISSING | Audit every agent call | Required acceptance test not implemented; no full completion claim. |
| RUN-12.2.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Audit every agent call" | Required acceptance test not implemented; no full completion claim. |
| RUN-12.2.2.T2 | task | MISSING | Build or confirm: `mcp_audit_events` with agent, tool, before, after | Required acceptance test not implemented; no full completion claim. |
| RUN-12.2.2.T3 | task | MISSING | Prove the agent path: Per agent | Required acceptance test not implemented; no full completion claim. |
| RUN-12.2.2.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3 | feature | MISSING | F12.3 Triggers, brief and setup packs | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.1 | pbi | MISSING | Triggers on the Worker cron | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Triggers on the Worker cron" | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.1.T2 | task | MISSING | Build or confirm: 06:45 brief, 17:47 close, Friday review from `agent_triggers` | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.1.T3 | task | MISSING | Prove the agent path: Calls the runtime webhook (Grok, muse or dots) from Secret settings | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.1.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.2 | pbi | MISSING | Reference brief writer | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Reference brief writer" | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.2.T2 | task | MISSING | Build or confirm: Worker job selects ten decisions per world into `run_briefs` without an LLM | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.2.T3 | task | MISSING | Prove the agent path: Grok can overwrite it with a richer brief | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.2.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.3 | pbi | MISSING | Setup packs | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.3.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Setup packs" | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.3.T2 | task | MISSING | Build or confirm: Instruction block per runtime: Grok bot, muse, dots, generic MCP | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.3.T3 | task | MISSING | Prove the agent path: One pack per agent | Required acceptance test not implemented; no full completion claim. |
| RUN-12.3.3.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-13 | epic | MISSING | E13 Settings | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1 | feature | MISSING | F13.1 Run settings | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.1 | pbi | MISSING | Day template editor | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Day template editor" | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.1.T2 | task | MISSING | Build or confirm: Blocks, kinds, days, world rule, preview | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.1.T3 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.1.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.2 | pbi | MISSING | Caps and targets | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.2.T1 | task | MISSING | Write the unit or component test for "Caps and targets" | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.2.T2 | task | MISSING | Build or confirm: Caps, SLA, late nights, 60/25/15, 170 h | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.2.T3 | task | MISSING | Prove the agent path: `get_caps` reflects changes immediately | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.2.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.2.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.3 | pbi | MISSING | Agents tab | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.3.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Agents tab" | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.3.T2 | task | MISSING | Build or confirm: Real tokens (shown once), scopes, triggers, run log, setup packs | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.3.T3 | task | MISSING | Prove the agent path: Create one token per agent | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.3.T4 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.3.T5 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.4 | pbi | MISSING | Data tab | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.4.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Data tab" | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.4.T2 | task | MISSING | Build or confirm: Export per world, audit viewer | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.4.T3 | task | MISSING | Match the golden screens and controls it touches | Required acceptance test not implemented; no full completion claim. |
| RUN-13.1.4.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-14 | epic | MISSING | E14 Hardening and release | Required acceptance test not implemented; no full completion claim. |
| RUN-14.1 | feature | MISSING | F14.1 Quality | Required acceptance test not implemented; no full completion claim. |
| RUN-14.1.1 | pbi | MISSING | End-to-end daily loop | Required acceptance test not implemented; no full completion claim. |
| RUN-14.1.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "End-to-end daily loop" | Required acceptance test not implemented; no full completion claim. |
| RUN-14.1.1.T2 | task | MISSING | Build or confirm: Empty workspace → agent fills via MCP → Queue → Decide approves a proposal → Close | Required acceptance test not implemented; no full completion claim. |
| RUN-14.1.1.T3 | task | MISSING | Prove the agent path: Uses a test agent token with propose scope | Required acceptance test not implemented; no full completion claim. |
| RUN-14.1.1.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-14.1.2 | pbi | MISSING | Performance budget | Required acceptance test not implemented; no full completion claim. |
| RUN-14.1.2.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Performance budget" | Required acceptance test not implemented; no full completion claim. |
| RUN-14.1.2.T2 | task | MISSING | Build or confirm: Run routes under 2 s on 4G | Required acceptance test not implemented; no full completion claim. |
| RUN-14.1.2.T3 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-14.2 | feature | MISSING | F14.2 Release | Required acceptance test not implemented; no full completion claim. |
| RUN-14.2.1 | pbi | MISSING | Turn the flag on for your instance | Required acceptance test not implemented; no full completion claim. |
| RUN-14.2.1.T1 | task | MISSING | Write the MCP contract test against the local Worker for "Turn the flag on for your instance" | Required acceptance test not implemented; no full completion claim. |
| RUN-14.2.1.T2 | task | MISSING | Build or confirm: Flag on per tenant | Required acceptance test not implemented; no full completion claim. |
| RUN-14.2.1.T3 | task | MISSING | Prove the agent path: Grok fill prompt runs the first day | Required acceptance test not implemented; no full completion claim. |
| RUN-14.2.1.T4 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |
| RUN-14.2.2 | pbi | MISSING | Docs | Required acceptance test not implemented; no full completion claim. |
| RUN-14.2.2.T1 | task | MISSING | Write the Firestore rules test on the emulator for "Docs" | Required acceptance test not implemented; no full completion claim. |
| RUN-14.2.2.T2 | task | MISSING | Build or confirm: `docs/run/` module guide, agent guide, UX rules | Required acceptance test not implemented; no full completion claim. |
| RUN-14.2.2.T3 | task | MISSING | Record the evidence | Required acceptance test not implemented; no full completion claim. |

## Supplied backlog totals

{"epic":15,"feature":32,"pbi":80,"task":355}

## Proven targeted fixes (not full-PBI sign-off)

- tests/runValidation.test.ts: malformed JSON shape, duplicate external IDs, cross-world epic conflicts, allocation sum/Monday, title format, cross-workspace adapter rejection, queue truncation regression.
- Queue renders all records instead of silently dropping records after 40. Decide is a single-card deck with typing-safe keyboard shortcuts.
- Actual over-cap counts are displayed, never clamped to five.
- Team browser cache is scoped by user and workspace; cloud sync is explicitly labelled unavailable.
- Core import preflight is read-only and exposed in Data & validation. There is deliberately no non-atomic Import or destructive Replace action.
- Personal has only Today, Life, Intake and Close navigation. This is UX scoping, not proof of private Firestore authorization.

## Input data preflight

Supplied 425-item file: 10 errors, 306 warnings. Errors at zero-based indexes 67/106/163 (title) and 234/239/240/241/258/265/266 (cross-world Epic). No input modified and no records imported. Human source ownership is required; do not infer which business owns a conflicting Epic.

## Remaining high-risk gaps

1. Atomic Worker/MCP cap enforcement and real propose/approve lifecycle; frontend caps are not concurrency protection.
2. Personal privacy and workspace-per-world migration need a defined mapping and backend/rules tests.
3. RunStore remains incomplete; Team/Manifesto browser state, Close, Week and Life persistence are not certified.
4. V2 goldens and inventory are now present. Full visual parity remains incomplete; the first two Today comparisons fail (~3% vs allowed 1%). Source UI export is still absent. Browser policy blocked opening the local reference HTML; no workaround was used.
5. Emulator-backed rules/MCP fixtures and full end-to-end proof are missing; production credentials were not used.

## Final executed evidence for this change

- `npm test`: tests 966 / pass 966 / fail 0. Includes the existing suite and new core preflight/regression tests. The two Functions package-loader failures were fixed in the test imports; security assertions remain intact.
- `npm run lint -- --quiet`: exit 0, no errors.
- `npx tsc -b --pretty false`: exit 0 after correcting the dialog's ES2020-incompatible Array.at call.
- `npm run lint:budget`: Debt budget OK (no metric rose).
- `npm run build`: production build completed successfully (existing large-chunk warnings remain).
- Local browser: `/run` renders in the existing demo session; Data & validation opens; Escape closes; focus returns to its trigger; Personal exposes Today/Life/Intake/Close. No live records were created.
- Browser computed styles after fix: primary CTA foreground rgb(255,255,255) on rgb(24,24,22); score font JetBrains Mono at 30px. This is a targeted UX check, NOT proof of 85 golden screens.
- Not run: emulator-backed rules, real MCP lifecycle/cron integration, the 85 visual comparisons or a production import. These remain missing/blocked, not PASS.

This ledger does not assert the requested 15/32/80/355 PASS target. Remaining rows retain FAIL/MISSING/BLOCKED until their complete acceptance criteria are implemented and exercised.

## V2 golden evidence and repeatable commands

The user-supplied archive was extracted outside the repository. No private screenshots or fixture rows are committed. To reproduce with your own extracted path:

```sh
CERTO_RUN_GOLDEN_DIR=/absolute/extracted/v2 npm run audit:run-goldens
CERTO_RUN_GOLDEN_DIR=/absolute/extracted/v2 npm run test:run-visual
```

- Integrity audit: 125 valid PNGs, desktop 50, phone 35, desktop-empty 40; inventory 50 screens / 3,113 controls; fixture present. SHA256 computed for each PNG.
- Actual clock: 2026-11-05T16:00Z; timezone America/Guatemala; desktop 1360×900 DPR1; phone smoke check 390×844 DPR3.
- Self-hosted font loading assertions PASS for Familjen Grotesk, Atkinson Hyperlegible and JetBrains Mono. No Google Fonts request is required by Run.
- Phone horizontal-overflow and validation-dialog Escape/focus check PASS.
- Pure AI empty Today: FAIL, 35,391 differing pixels (~3%). Boldr AI empty Today: FAIL, 36,309 differing pixels (~3%). Limit remains 1%. Originals were not changed.
- All remaining 123 screen comparisons and full 3,113-control parity have NOT been executed. No fixture was written through MCP; these are deliberately non-mutating view tests, not full integration proof.
- UI changes: full-width Run content with shared auth intact, self-hosted fonts, real empty-state action, schedule rail and meetings/follow-up panel. Private pages and shared dialogs are not hidden; Back to Certo remains on the avatar.
- Final v2-change checks: `npm test` 968 tests / 968 pass / 0 fail; `npm run lint -- --quiet` exit 0; `npm run lint:budget` no metric rose; `npm run build` exit 0 (`✓ built in 5.28s`). The visual command exits 1 for the two genuine comparison failures, with the phone smoke check passing. This is kept as a draft, not a production-ready parity claim.



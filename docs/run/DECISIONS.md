# Certo Run decisions

## 2026-11-05 v2 goldens received (supersedes missing-baseline notes below)

The user supplied certo-run-ux-golden-v2.zip. Verified 125 PNGs: 50 desktop at 1360px, 35 phone at 1170 physical pixels (390 CSS px × DPR3), 40 desktop-empty. The manifest fixes 2026-11-05T16:00Z, Guatemala timezone. Inventory contains 3,113 controls across 50 desktop screens. The fixture is present. The archive, screenshots, inventory and private fixture remain local, not committed or imported into production.

`scripts/audit-run-goldens.mjs` verifies structure, dimensions, counts and computes each SHA256. The Playwright config requires an external `CERTO_RUN_GOLDEN_DIR`, disables snapshot updates and keeps the 1% threshold. Tests render the actual RunDeskView in a test-only entry with no live data subscription. This is UI-only evidence, not MCP fixture seeding or end-to-end auth/rules evidence.

The existing browser session required no login changes. The visual suite independently uses no production fixture data or subscriptions. No screen is marked golden-PASS unless it actually passes. The provided fixture-driven MCP lifecycle and the remaining screens are still unimplemented tests.

Self-hosted fonts use @fontsource packages. pnpm could not run because the repository's existing pnpm-workspace.yaml is malformed ("packages field missing or empty"); npm, the repository's CI installer, updated package.json and package-lock.json instead. No unrelated dependency audit fixes were applied.

## Private rollout — explicit owner direction

Run is available only to the verified account explicitly designated by the product owner. No workspace role, membership, invitation or user-editable feature flag grants access. Sidebar, account menu, mobile dock, direct routes and lazy module mounting enforce the same predicate. No grant-management UI or additional recipients were added.

Firestore Run-item mutations require that same verified identity on both existing and incoming records, preventing non-authorized users from removing the Run marker as a bypass. Generic workspace MCP tokens neither list nor fetch Run items. Existing task read ACLs are unchanged: tightening those in-place without adapting workspace-wide queries would break Firestore query authorization for ordinary Work. This change restricts module use and mutations, but is NOT a certification of confidential isolation for legacy Run data already stored in shared tasks. A private-data migration remains a separate required hardening step before any broader rollout.

Verification: 969 unit tests pass, including denied non-owner/unverified accounts, direct-route gating, rules mutation guard and generic MCP item refusal. No access was granted to any additional account. Firestore rules must deploy with the application; a local test is not evidence of deployed rules.

## 2026-11-05 validation against supplied v2 pack

The new validation pack supplies compiled reference/empty HTML, a 482-row backlog (15 epics, 32 features, 80 PBIs, 355 tasks) and ingestion data. It does not supply source UI files, the 85 golden screenshots or interaction-inventory.json. Reference HTML was inspected as text; browser security policy refused its file URL and no workaround was attempted. The actual local Certo app was inspected in the browser using its existing demo session, without creating production test records.

Do not replace the working app with the standalone localStorage HTML: that would discard the existing auth, permissions and cloud data model. Do not automatically import the user's 425 records: preflight finds the stated 10 errors and cannot decide ownership of cross-world epics. The new Data & validation dialog is deliberately read-only and describes its limited core-validation coverage. All-or-nothing import is not claimed until an authoritative backend implementation exists.

The delivered fixes are targeted, not a claim to complete E0–E14. The earlier same-document design and world-field storage remain; changing to isolated entries and workspace-per-world is a migration/security decision. Team's existing browser-only allocation cache is now keyed by workspace/user/world; no unscoped legacy cache is automatically migrated. A visible notice states cloud sync is not connected. No extra listeners, Firebase apps, AI calls, cron jobs or infrastructure were added.

The local browser revealed a black-on-black primary button and shell-forced Inter/compact typography. Scoped Run overrides restore visible primary labels, 30px mono counters and the specified display font without altering Certo's global stylesheet. This contains a known leak, but is not full CSS-isolation or pixel-parity proof.

The full suite's two module-loading failures were corrected using createRequire in tests to consume the existing Functions CommonJS package. File-access implementation and authorization were not modified.

## 2026-11-03 (America/Guatemala)

The AI Studio export from 10:17 pm and `certo-run-ux-golden.zip` are not in the repo, the uploads, or Drive. E1 cannot copy the UI file by file or run the 85-screen gate until those two files are unzipped at `incoming/certo-run-aistudio/` and `tests/run-visual/golden/`. Work continues on everything that does not need those pixels.

There is one Certo Work app and one HTML document. `/run` is a route in that app, the same way `/my-work` and `/projects` are. The sidebar, the account menu, and the phone dock open it with the Certo router. The desk is `CertoRunDesk` inside the Certo shell. It reads and writes items in `tasks`.

There is no `run.html`, no second Vite entry, and no Worker route that serves a different document for `/run`. `commandRun` remains in the flag list and defaults off. It does not hide the module and it does not load a second app.

Worlds stay on the item field `runWorld` for this change. An earlier decision said Personal Focus is a Certo workspace and not a Run world, and that the desk must not switch workspaces. Epic E2 says each world is a workspace and the Run switch changes Certo's active workspace. That conflict is not resolved here. E2 will record which rule wins before any workspace switch is added.

`src/run/domain` re-exports `src/lib/certoRun`. The Worker imports that module from `worker/runDomain.js`. When the AI Studio `packages/domain` arrives, replace this re-export if the export differs. Do not keep two copies of the rules.

Tailwind v4 is not installed. Certo still builds with Tailwind 3. Replacing that package would put Run's pipeline on Certo's styles. The Run entry gets Tailwind v4 with the verbatim `tokens.css` when the AI Studio export is here.

`RunStore` exports the AI Studio action names. Item writes still throw until they go through Firestore and the Worker cap routes. The only `localStorage` write is the last world, which is a UI convenience. RUN-0.2.1 is not done.

The response header `x-certo-run-caps` on Run HTML is the Worker reading `DEFAULT_CAPS` from the shared domain. It is not a client API.

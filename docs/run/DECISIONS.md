# Certo Run decisions

## 2026-11-03 (America/Guatemala)

The AI Studio export from 10:17 pm and `certo-run-ux-golden.zip` are not in the repo, the uploads, or Drive. E1 cannot copy the UI file by file or run the 85-screen gate until those two files are unzipped at `incoming/certo-run-aistudio/` and `tests/run-visual/golden/`. Work continues on everything that does not need those pixels.

There is one Certo Work app and one HTML document. `/run` is a route in that app, the same way `/my-work` and `/projects` are. The sidebar, the account menu, and the phone dock open it with the Certo router. The desk is `CertoRunDesk` inside the Certo shell. It reads and writes items in `tasks`.

There is no `run.html`, no second Vite entry, and no Worker route that serves a different document for `/run`. `commandRun` remains in the flag list and defaults off. It does not hide the module and it does not load a second app.

Worlds stay on the item field `runWorld` for this change. An earlier decision said Personal Focus is a Certo workspace and not a Run world, and that the desk must not switch workspaces. Epic E2 says each world is a workspace and the Run switch changes Certo's active workspace. That conflict is not resolved here. E2 will record which rule wins before any workspace switch is added.

`src/run/domain` re-exports `src/lib/certoRun`. The Worker imports that module from `worker/runDomain.js`. When the AI Studio `packages/domain` arrives, replace this re-export if the export differs. Do not keep two copies of the rules.

Tailwind v4 is not installed. Certo still builds with Tailwind 3. Replacing that package would put Run's pipeline on Certo's styles. The Run entry gets Tailwind v4 with the verbatim `tokens.css` when the AI Studio export is here.

`RunStore` exports the AI Studio action names. Item writes still throw until they go through Firestore and the Worker cap routes. The only `localStorage` write is the last world, which is a UI convenience. RUN-0.2.1 is not done.

The response header `x-certo-run-caps` on Run HTML is the Worker reading `DEFAULT_CAPS` from the shared domain. It is not a client API.

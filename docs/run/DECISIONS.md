# Certo Run decisions

## 2026-11-03 (America/Guatemala)

The AI Studio export from 10:17 pm and `certo-run-ux-golden.zip` are not in the repo, the uploads, or Drive. E1 cannot copy the UI file by file or run the 85-screen gate until those two files are unzipped at `incoming/certo-run-aistudio/` and `tests/run-visual/golden/`. Work continues on everything that does not need those pixels.

`/run` is the Certo module. A root `run.html` made Vite serve a second document at that path, so the entry now lives at `src/run/entry.html` and is not the route people open.

Wrangler has one asset directory, `dist/client`. The Run entry is emitted as `dist/client/run.html` and copied to `dist/run/index.html`. `/run` and `/run/*` are in `run_worker_first` so the Certo SPA fallback does not answer those routes. HTML under `/run` is served from `/run.html`.

`commandRun` still defaults off in `resolveFeatureFlag`. The module itself is always in the Certo sidebar. Opening Run stays inside the Certo document at `/run` and mounts `CertoRunDesk`, which reads and writes items in `tasks`. A separate Run document was hiding the module behind a console flag and showed an empty page.

Worlds stay on the item field `runWorld` for this change. An earlier decision said Personal Focus is a Certo workspace and not a Run world, and that the desk must not switch workspaces. Epic E2 says each world is a workspace and the Run switch changes Certo's active workspace. That conflict is not resolved here. E2 will record which rule wins before any workspace switch is added.

`src/run/domain` re-exports `src/lib/certoRun`. The Worker imports that module from `worker/runDomain.js`. When the AI Studio `packages/domain` arrives, replace this re-export if the export differs. Do not keep two copies of the rules.

Tailwind v4 is not installed. Certo still builds with Tailwind 3. Replacing that package would put Run's pipeline on Certo's styles. The Run entry gets Tailwind v4 with the verbatim `tokens.css` when the AI Studio export is here.

`RunStore` exports the AI Studio action names. Item writes still throw until they go through Firestore and the Worker cap routes. The only `localStorage` write is the last world, which is a UI convenience. RUN-0.2.1 is not done.

The response header `x-certo-run-caps` on Run HTML is the Worker reading `DEFAULT_CAPS` from the shared domain. It is not a client API.

# Route migration matrix

| Current URL | Current meaning | Target concept | Canonical URL | Redirect / alias | Risk |
| --- | --- | --- | --- | --- | --- |
| `/`, `/home`, `/boldi` | Home / Odysseus | Home | `/home` | keep aliases → home | low |
| `/work` | Command Center | Projects | `/projects` | `/work` → portfolio | low |
| `/work/tasks`, `/work/action-board`, `/action-board` | Items / Action Board | My Work | `/my-work` | legacy → my-work/assigned | low |
| `/capture`, `/inbox`, `/rich-capture` | Intake (often mis-routed) | My Work Inbox | `/my-work/inbox` | alias | medium (behavior fix) |
| `/work/projects/:id…` | Project object | Project | keep `/work/projects/:id` | optional `/projects/:id` alias | medium if dual |
| `/approvals`, `/capture/review`, `/review*` | Approvals | Approvals | `/approvals` | keep | low |
| `/settings`, `/me*` | Settings | Settings | `/settings` | keep | low |
| `/more/automations`, `/skills` | Automations | Agents → Automations | `/agents/automations` | `/more/automations` alias | low |
| `/more/updates`, `/digest` | Updates | Agents → Activity | `/agents/activity` | alias | low |
| `/more/workspace` | Workspace admin | Workspace & team | `/workspace` | `/more/workspace` alias | low |
| `/work/agent-workspace` | War Room (unmounted) | Agents | `/agents` | home→agents | low |
| `/more/habits`, `/more/workouts`, `/more/warroom`, `/more/knowledge` | Hidden More | Personal / Agents | keep resolving; not primary | deferred | low |
| `/delivery-os`, `/projects-deals`, `/operations-hub` | Portfolio aliases | Projects | `/projects` | keep | low |

## Writers (`lensToPath`)

| Lens | Path |
| --- | --- |
| home | `/home` |
| my-work/assigned | `/my-work` |
| my-work/inbox | `/my-work/inbox` |
| my-work/waiting | `/my-work/waiting` |
| work/portfolio | `/projects` |
| work/issues | `/my-work` (compat writer) |
| work/intake | `/my-work/inbox` |
| agents/home | `/agents` |
| agents/automations | `/agents/automations` |
| agents/activity | `/agents/activity` |
| project | `/work/projects/:id…` |
| approvals | `/approvals` |
| settings | `/settings` |
| more/* | `/more/:section` (compat) |

# Decisions

- Certo Run is a module of Certo Work, opened from the sidebar, the account menu, and the phone dock at `/run`. It uses the same Firebase project and the signed-in workspace. Its records live in `run_items`, not in `tasks`. Work is not copied in, and nothing here writes a work task. The desk starts empty.
- Import of the backlog is left for later. No seed documents are created.
- Work blocks named Pure AI or Boldr AI in the day template stay on those workspaces. Any other workspace sees those blocks as its own world, so the day is usable without renaming the workspace.
- Only a workspace named Personal uses the life tabs. The default Certo Work workspace, Personal Focus, keeps the full desk: Today, Queue, Projects, Intake, and Close.
- November 2026 has 21 Monday–Friday dates. The day-count helper follows that calendar.

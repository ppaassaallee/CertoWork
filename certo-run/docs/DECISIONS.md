# Decisions

- Certo Run is a module of Certo Work, opened from the sidebar, the account menu, and the phone dock at `/run`. It uses the signed-in workspace, Firebase Auth, and the existing `tasks` collection. It does not add a database, a server, or a second Firebase project.
- Queue membership is derived from fields Certo Work already stores (`itemType`, `isOneThing`, `tags`, `gtdContext`) plus an optional `runDecision` written back onto the same task. Items with no decision stay out of the five queues until someone marks them.
- Work blocks named Pure AI or Boldr AI in the day template stay on those workspaces. Any other workspace sees those blocks as its own world, so the day is usable without renaming the workspace.
- Only a workspace named Personal uses the life tabs. The default Certo Work workspace, Personal Focus, keeps the full desk: Today, Queue, Projects, Intake, and Close.
- November 2026 has 21 Monday–Friday dates. The day-count helper follows that calendar.

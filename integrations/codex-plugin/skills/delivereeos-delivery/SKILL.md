---
name: delivereeos-delivery
description: Use when a DelivereeOS handoff code, project, Epic, Feature, PBI, story, task, bug, or delivery sync is mentioned, or when Codex should return engineering progress and evidence to DelivereeOS.
---

# DelivereeOS delivery

Use DelivereeOS as the delivery source of truth for the project and work items explicitly shared with this Codex task.

## Start a linked task

1. Obtain the handoff code from the user-provided launch brief. If no code is present, call `list_delivery_links` and ask the user to select only when more than one plausible project remains.
2. Call `get_delivery_context` before planning or editing. Read the project outcome, selected work, hierarchy, acceptance criteria, dependencies, and knowledge summaries.
3. Call `link_codex_task` with the handoff code, a concise title, and the current Codex task reference when one is available. Do not invent a task URL or ID.
4. Claim only an item with `readyForCodex: true` by calling `claim_work_item` before implementation.

## Execute and report

- Work inside the repository named in the handoff. If the local repository differs, stop and explain the mismatch.
- Preserve DelivereeOS work-item IDs, keys, parent links, requirement IDs, and acceptance criteria.
- Report meaningful state changes with `report_work_item_progress`: `in_progress`, `in_review`, or `blocked`.
- A missing detail is a gap to report, not a reason to lecture or abandon safe in-scope work. Call `report_project_gap` for missing scope, dependencies, security decisions, data contracts, test evidence, or acceptance criteria. Suggestions return to DelivereeOS for review.
- Do not create unrelated work, cross projects, or expand scope through a progress call.

## Completion contract

Before calling `complete_work_item`:

1. Verify the actual repository changes.
2. Run the relevant build, tests, lint, migrations, or checks in proportion to risk.
3. Compare the result with the work item's acceptance criteria.
4. Report only real files, commands/results, commit SHA, pull request, build, or deployment URLs. Omit values that do not exist.
5. Include knowledge notes that will help the next engineer understand decisions, configuration, migrations, operational behavior, and remaining gaps.
6. If the work is not complete, report progress or blocked status instead of using completion.

DelivereeOS may apply progress, completion, and evidence automatically only when the handoff explicitly pre-authorized that scope. New work and scope changes always remain reviewable.

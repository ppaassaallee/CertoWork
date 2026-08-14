# Certo Work PM experience blueprint

This blueprint is the product filter for the Portfolio, Project Console, Items, Costs, and conversational surfaces. It is intentionally smaller than a full Jira clone: every screen must help a delivery leader understand, decide, update, or communicate.

## Ten weekly PM workflows

1. Start Monday by reviewing portfolio exceptions, deadlines, blocked work, and capacity.
2. Confirm the two or three outcomes each active project must advance this week.
3. Prepare and run backlog refinement with Epics, Features, PBIs, owners, dates, and dependencies.
4. Prepare sprint or phase planning and verify realistic team capacity.
5. Assign or rebalance work across one or many contributors.
6. Follow up on blocked work and convert each blocker into an owner and next action.
7. Review delivery dates and decide what moves, de-scopes, or escalates.
8. Check planned versus actual hours and cost variance before it becomes material.
9. Produce a concise stakeholder update with progress, decisions, risks, and next steps.
10. Close the week by updating evidence, marking completed work, and preparing next week.

## Ten monthly PM workflows

1. Review the complete portfolio by BPO, client, stage, health, service, and accountable owner.
2. Reconcile project stage and status so pipeline reporting is trustworthy.
3. Review initial, recurring, labor, vendor, implementation, and support cost variance.
4. Forecast remaining effort and expected completion dates.
5. Review critical risks, aging blockers, and unresolved decisions.
6. Confirm sponsor, Product Owner, Project Manager, and delivery lead accountability.
7. Review roadmap progress by Epic and delivery checkpoint.
8. Archive completed work and recover incorrectly deleted projects within the retention window.
9. Produce filtered portfolio and project reports for executives and clients.
10. Decide which projects to start, pause, continue, or stop next month.

## Ten conversational questions a PM asks Certo

1. “What needs my attention today, and why?” — answer from overdue dates, blocked items, critical risks, and missing owners.
2. “Which projects are likely to miss their date?” — show evidence, confidence, and the smallest corrective action.
3. “What changed since last week?” — compare status, dates, scope, costs, and completed work.
4. “Prepare my steering committee update.” — produce a reviewable draft with source projects and no invented facts.
5. “Where are we over budget or over hours?” — compare planned and actual quantities by cost driver and phase.
6. “Who is overloaded or unassigned?” — use item assignments and capacity; never infer people who are not workspace members.
7. “What should we do next in this project?” — answer within project context, without lecturing about unrelated portfolio work.
8. “Plan the next sprint or delivery phase.” — propose scope, owners, dependencies, dates, acceptance evidence, and capacity warnings.
9. “Show me all projects for this BPO/client/owner/stage.” — open the same filtered Portfolio view instead of returning a detached text list.
10. “What decision is blocking delivery?” — identify the decision, accountable owner, due date, consequences, and recommended option.

## Experience rules

- Portfolio starts with exceptions and supports drill-down by any meaningful business dimension.
- A clicked metric or taxonomy value must always change the visible result set and show an active filter.
- Project Console is the editable source of truth; conversation assists it but does not replace visible project data.
- Backlog owns hierarchy; Board owns execution status; Plan derives checkpoints from Epics.
- Costs show quantities, units, rates, planned/actual values, cadence, and variance in one auditable model.
- Health is explainable: blocked work, critical/open risks, overdue dates, and an explicit manual override.
- Progressive disclosure keeps dashboards calm: summary first, editable detail after deliberate navigation.
- Controls use consistent shadcn/ui-inspired primitives: button, badge, tabs, select, popover, tooltip, table, empty state, and alert dialog.
- Every destructive action is reversible when possible and states its retention behavior before confirmation.
- Conversational answers link back to the exact project, item, filter, or cost view that supports the answer.

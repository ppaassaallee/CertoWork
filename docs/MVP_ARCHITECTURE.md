# Conversation-first MVP architecture

## Strangler boundary

The new conversational home wraps the current product rather than replacing it:

1. The left navigation links to existing routes.
2. Workspace context is read from existing task, project, goal, calendar, knowledge, conversation, and membership collections.
3. Deterministic judgment runs before provider invocation.
4. The provider returns a structured response and optional typed proposal.
5. The user approves a proposal into the existing review queue.
6. Existing review and execution paths remain authoritative.

## Provider routing

`BOLDI_AI_PROVIDER` accepts `auto`, `openai`, or `gemini`.

- `auto`: use OpenAI when `OPENAI_API_KEY` exists; otherwise use Gemini.
- `openai`: use the Responses API adapter.
- `gemini`: preserve the existing Google GenAI adapter and fallback chain.

Both adapters satisfy the existing `/api/boldi/chat` JSON contract. Provider metadata is stored on assistant messages for auditability.

## Judgment engine

`src/lib/judgment.ts` is intentionally model-independent. It currently checks:

- explicit past dates;
- daily due-item capacity;
- active-project WIP;
- probable duplicate tasks;
- vague next actions;
- project requests without observable outcomes;
- repeated postponement;
- active projects without outcomes.

It returns a verdict, evidence signals, capacity facts, six decision dimensions, alternatives, conditions, and the distinction between what the user wants to hear and needs to hear. The structured result is passed to the model as evidence and is rendered directly in the interface.

## Safe action lifecycle

`proposed → user approves → approved_for_review → existing review queue → execution`

The first approval does not execute. It creates:

- one `boldi_action_plans` record;
- one `boldi_actions` record per proposed action;
- one `review_candidates` record per proposed action.

Undo marks these records `undone` or `dismissed`; redo restores their reviewable state.

## Memory and tenancy

Every conversational query and write includes `userId` and `workspaceId`. The UI never combines data across selected workspaces. Knowledge citations preserve their Firestore IDs and link to the existing knowledge detail route.

Longer-term semantic retrieval can replace the current lexical matching behind the same citation contract without changing the conversation or knowledge collections.

## Offline behavior

When the network or AI provider is unavailable:

- the deterministic judgment engine still runs in the browser;
- the request is appended to a device-local capture queue;
- the interface states that no AI processing or execution occurred;
- queued captures synchronize additively into `inbox_items` when connectivity returns.

## Feature flags

`src/lib/featureFlags.ts` resolves defaults with explicit precedence:

`environment → tenant → workspace → user`

The resolver is pure and test-covered so it can be backed by Firestore, remote configuration, or deployment environment values without changing feature code.


# Certo Work project fields

- **Project:** editable display name. The project key remains stable.
- **BPO:** delivery organization. Existing values act as a workspace master list; typing a new value adds it to future suggestions.
- **Client:** customer receiving the outcome. Existing values act as a workspace master list; typing a new value adds it to future suggestions.
- **Stage:** fixed Certo delivery lifecycle: Define, Onboarding, Build, Deploy, Operations.
- **Phase:** flexible substage inside a Stage, such as Discovery, Development, UAT, Hypercare, or Support Transition.
- **Status:** administrative state of the record: Idea, Planning, Active, Paused, Completed, or Archived.
- **Health:** automatic unless overridden. Blocked work or a critical open risk produces Blocked; any other open risk or an overdue active project produces At risk; otherwise it is On track.
- **Progress:** automatic unless overridden. Automatic progress is completed executable items divided by all executable PBIs, stories, tasks, bugs, and subtasks. Epics and Features are planning containers and do not inflate progress.
- **Due:** editable delivery date. A revised date takes precedence over the original target.
- **Solution Architect:** accountable for solution design and technical coherence.
- **Project Manager:** accountable for delivery planning, coordination, status, dependencies, and escalation.

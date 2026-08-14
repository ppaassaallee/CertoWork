# Certo Work project fields

- **Project:** editable display name. The project key remains stable.
- **BPO:** delivery organization. Existing values act as a workspace master list; typing a new value adds it to future suggestions.
- **Client:** customer receiving the outcome. Existing values act as a workspace master list; typing a new value adds it to future suggestions.
- **Stage:** fixed Certo delivery lifecycle: Define, Onboarding, Build, Deploy, Operations.
- **Phase:** controlled checkpoint inside a Stage. It is always selected from a closed list and changes with the selected Stage.

## Standard Stage → Phase model

- **Define:** Intake, Qualification, Discovery, Business case & approval.
- **Onboarding:** Kickoff, Requirements, Solution design, Ready for build.
- **Build:** Development, Integration, Internal QA, Ready for UAT.
- **Deploy:** User acceptance testing, Release readiness, Go-live, Hypercare.
- **Operations:** Live operations, Support & SLA, Optimization, Renewal / closure.

Legacy labels such as `Diseño`, `Desarrollo`, `QA`, `Pre-Producción`, and `Producción` are normalized into this model. Changing Stage also moves an incompatible Phase to the first valid checkpoint of the new Stage.
- **Status:** administrative state of the record: Idea, Planning, Active, Paused, Completed, or Archived.
- **Health:** automatic unless overridden. Blocked work or a critical open risk produces Blocked; any other open risk or an overdue active project produces At risk; otherwise it is On track.
- **Progress:** automatic unless overridden. Automatic progress is completed executable items divided by all executable PBIs, stories, tasks, bugs, and subtasks. Epics and Features are planning containers and do not inflate progress.
- **Due:** editable delivery date. A revised date takes precedence over the original target.
- **Solution Architect:** accountable for solution design and technical coherence.
- **Project Manager:** accountable for delivery planning, coordination, status, dependencies, and escalation.

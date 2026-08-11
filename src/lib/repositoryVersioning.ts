export type VersioningStrategy = "simple_semver" | "date_based" | "sprint_release" | "manual";

export const REPOSITORY_VERSION_MODEL = [
  {
    id: "repository",
    label: "Repository",
    evidence: "Canonical repo URL or local folder",
    rule: "One project may link several repos, but each Codex handoff must name the repo it is touching.",
  },
  {
    id: "branch",
    label: "Branch",
    evidence: "Branch name",
    rule: "Every non-trivial change should happen on a named branch or clearly state why not.",
  },
  {
    id: "commit",
    label: "Commit",
    evidence: "Commit SHA",
    rule: "A commit is evidence of source state, not evidence of release.",
  },
  {
    id: "pull_request",
    label: "Pull request",
    evidence: "PR URL or review note",
    rule: "PR/review status should be tracked separately from completion.",
  },
  {
    id: "build",
    label: "Build / tests",
    evidence: "Build URL, test list, or explicit local verification",
    rule: "Done requires truthful test or acceptance evidence.",
  },
  {
    id: "release",
    label: "Release version",
    evidence: "Version number, release candidate, or release note",
    rule: "A release groups completed work into something users can understand.",
  },
  {
    id: "deployment",
    label: "Deployment",
    evidence: "Environment and deployed URL",
    rule: "Deployment is production/user evidence only when a real URL or environment exists.",
  },
  {
    id: "rollback",
    label: "Rollback",
    evidence: "Rollback note or prior version",
    rule: "Risky releases need a rollback path before they are considered safe.",
  },
  {
    id: "knowledge",
    label: "Knowledge",
    evidence: "Delivery note, decision, gap, or runbook update",
    rule: "Certo Work should remember what changed and what remains missing.",
  },
] as const;

export const VERSIONING_STRATEGIES: Array<{
  id: VersioningStrategy;
  label: string;
  description: string;
}> = [
  { id: "simple_semver", label: "Simple SemVer", description: "Use vMAJOR.MINOR.PATCH for product releases." },
  { id: "date_based", label: "Date based", description: "Use YYYY.MM.DD or YYYY.MM.DD-n for frequent internal deployments." },
  { id: "sprint_release", label: "Sprint release", description: "Use sprint or increment names when Scrum planning drives release cadence." },
  { id: "manual", label: "Manual", description: "Record release labels only when the team explicitly creates one." },
];

export function deliveryEvidenceReadiness(payload: Record<string, any> = {}) {
  const hasCommit = Boolean(payload.commitSha);
  const hasReview = Boolean(payload.pullRequestUrl || payload.reviewEvidence);
  const hasBuild = Boolean(payload.buildUrl || (Array.isArray(payload.tests) && payload.tests.length > 0));
  const hasRelease = Boolean(payload.releaseVersion || payload.releaseNotes);
  const hasDeployment = Boolean(payload.deploymentUrl || payload.environment);
  const hasKnowledge = Array.isArray(payload.knowledgeNotes) && payload.knowledgeNotes.length > 0;
  const missing = [
    !hasCommit && "commit",
    !hasBuild && "build_or_tests",
    !hasRelease && "release_note_or_version",
    !hasDeployment && "deployment_or_environment",
    !hasKnowledge && "knowledge_note",
  ].filter(Boolean) as string[];

  return {
    hasCommit,
    hasReview,
    hasBuild,
    hasRelease,
    hasDeployment,
    hasKnowledge,
    missing,
    status: missing.length === 0 ? "release_ready" : hasCommit && hasBuild ? "code_ready" : "needs_delivery_evidence",
  };
}

export function repositoryVersionContractText() {
  return `Repository and version contract:
- Name the repository and branch touched by the work.
- Report commit SHA, PR/review link, build or test evidence, release version/notes, deployment URL or environment, rollback notes, and knowledge notes only when real.
- Do not treat a commit as a release, or a release as a deployment.
- If repo/version evidence is missing, report the gap instead of inventing status.`;
}

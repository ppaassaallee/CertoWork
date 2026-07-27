export type BoldrOSPhase = 
  | "PHASE 1 — Qualification"
  | "PHASE 2 — Handoff"
  | "PHASE 3 — Discovery & Blueprint"
  | "PHASE 4 — Build, QA & Launch"
  | "PHASE 5 — Operate, Optimize & Expand"
  | "Archived";

export const PIPELINE_STAGES = [
  "New Opportunity",
  "Qualified AI Opportunity",
  "Workflow Pain Confirmed",
  "Fit & Readiness Validated",
  "Scope Proposed",
  "Commercial Review",
  "Closed Won — Handoff Required",
  "Handoff Review",
  "Pre-Kickoff Validation",
  "Kickoff Scheduled",
  "Discovery Active",
  "Current Workflow Mapped",
  "Opportunity Prioritized",
  "Future-State Blueprint Approved",
  "Build in Progress",
  "Internal QA",
  "Client Review",
  "Launch Ready",
  "Live / Adoption",
  "Optimization",
  "Monthly Business Review",
  "Complete / Retainer",
  "Closed / Archived"
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number];

export function getPhaseForStage(stage: PipelineStage): BoldrOSPhase {
  const index = PIPELINE_STAGES.indexOf(stage);
  if (index < 0) return "Archived";
  if (index <= 6) return "PHASE 1 — Qualification";
  if (index <= 7) return "PHASE 2 — Handoff"; // Handoff Review
  if (index <= 9) return "PHASE 2 — Handoff"; // Pre-Kickoff, Kickoff Scheduled
  if (index <= 13) return "PHASE 3 — Discovery & Blueprint"; // Discovery to Blueprint Approved
  if (index <= 17) return "PHASE 4 — Build, QA & Launch"; // Build to Launch Ready
  if (index <= 21) return "PHASE 5 — Operate, Optimize & Expand"; // Live to Complete
  return "Archived";
}

export interface BoldrProject {
  id?: string;
  userId: string;
  workspaceId: string;
  name: string;
  companyName: string;
  stage: PipelineStage;
  deliveryRiskLevel: "low" | "medium" | "high";
  
  hubspotDealId?: string;
  hubspotCompanyId?: string;
  googleDriveFolderLink?: string;
  
  primaryClientContact?: string;
  executiveSponsor?: string;
  clientProcessOwner?: string;
  technicalAccessOwner?: string;
  
  commercialOwner?: string;
  deliveryOwner?: string;
  successOwner?: string;
  
  proposedTier?: string;
  scopeSold?: string;
  exclusions?: string;
  workflowCandidate?: string;
  systemsInvolved?: string;
  
  timelineExpectations?: string;
  successCriteria?: string;
  
  handoffStatus?: "pending" | "approved" | "rejected";
  handoffScore?: number;
  projectHealth?: "green" | "yellow" | "red";
  clientBlockerStatus?: "clear" | "blocked";
  internalBlockerStatus?: "clear" | "blocked";
  
  targetKickoffDate?: string;
  targetLaunchDate?: string;

  createdAt: any;
  updatedAt: any;
}

export interface BoldrInitiative {
  id?: string;
  userId: string;
  workspaceId: string;
  projectId: string;
  workflowName: string;
  department: string;
  status: "Candidate" | "Selected" | "Mapped" | "Prioritized" | "Designed" | "In Build" | "In QA" | "In Review" | "Live" | "Optimizing" | "Completed" | "Parked";
  painArea: string;
  googleDriveFolderLink?: string;
  createdAt: any;
  updatedAt: any;
}

export interface BoldrBlocker {
  id?: string;
  userId: string;
  workspaceId: string;
  title: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "resolved";
  projectId?: string;
  createdAt: any;
  updatedAt: any;
}

export interface BoldrQA {
  id?: string;
  userId: string;
  workspaceId: string;
  projectId: string;
  status: "pending" | "passed" | "failed";
  issuesFound: number;
  testDate: any;
  createdAt: any;
  updatedAt: any;
}

export interface BoldrMBR {
  id?: string;
  userId: string;
  workspaceId: string;
  projectId: string;
  month: string;
  status: "pending" | "completed";
  decisionRequired: string;
  googleDriveLink?: string;
  createdAt: any;
  updatedAt: any;
}

export interface BoldrArtifact {
  id?: string;
  userId: string;
  workspaceId: string;
  projectId: string;
  type: string;
  name: string;
  googleDriveLink: string;
  status: "missing" | "draft" | "approved";
  createdAt: any;
  updatedAt: any;
}
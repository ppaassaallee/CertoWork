import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  BrainCircuit,
  Briefcase,
  ClipboardCheck,
  FileText,
  Gauge,
  Headphones,
  Layers,
  Loader2,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";

type DeliveryTab =
  | "overview"
  | "intake"
  | "portfolio"
  | "delivery"
  | "promptops"
  | "artifacts"
  | "support"
  | "reviews"
  | "integrations";

const tabs: Array<{ id: DeliveryTab; label: string; icon: any }> = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "intake", label: "Intake", icon: ClipboardCheck },
  { id: "portfolio", label: "Portfolio", icon: Layers },
  { id: "delivery", label: "Delivery", icon: Rocket },
  { id: "promptops", label: "PromptOps", icon: BrainCircuit },
  { id: "artifacts", label: "Artifacts", icon: Boxes },
  { id: "support", label: "Support", icon: Headphones },
  { id: "reviews", label: "Reviews", icon: FileText },
  { id: "integrations", label: "Integrations", icon: Settings },
];

const deliveryStages = [
  "idea",
  "assessment",
  "approved",
  "planning",
  "delivery",
  "uat",
  "production",
  "support",
  "archived",
];

const starterPlaybooks = [
  ["delivereeos_ai_intake", "AI Intake Playbook", "Qualify AI opportunities without overcommitting delivery capacity."],
  ["delivereeos_delivery_gates", "Delivery Gate Playbook", "Run AI delivery through clear evidence-based gates."],
  ["delivereeos_promptops", "PromptOps Playbook", "Version, review, and promote prompts as governed assets."],
  ["delivereeos_release_readiness", "Release Readiness Playbook", "Prepare AI systems for UAT, production, rollback, and support."],
  ["delivereeos_support_tiering", "Support Tiering Playbook", "Route AI incidents through Tier 1, Tier 2, and Tier 3 support."],
  ["delivereeos_weekly_qa", "Weekly AI QA Review Playbook", "Review AI quality with real metrics and visible gaps."],
  ["delivereeos_mbr", "MBR Preparation Playbook", "Turn delivery, support, and quality data into an executive review."],
];

const starterSkills = [
  ["delivereeos_initiative_brief", "Draft AI Initiative Brief", "Convert raw opportunity notes into an editable business brief."],
  ["delivereeos_score_opportunity", "Score AI Opportunity", "Assess value, urgency, risk, effort, complexity, reuse, and alignment."],
  ["delivereeos_delivery_plan", "Generate Delivery Plan", "Draft gates, milestones, owners, risks, and first actions."],
  ["delivereeos_prompt_qa", "Generate Prompt QA Checklist", "Review prompt quality, expected behavior, test cases, and risks."],
  ["delivereeos_runbook", "Generate Runbook", "Draft support procedures, escalation path, owner, and rollback notes."],
  ["delivereeos_release_checklist", "Generate Release Checklist", "Create UAT, observability, support, rollback, and client-readiness checks."],
  ["delivereeos_support_weekly", "Generate Support Weekly Report", "Summarize support cases, severity, escalation, and unresolved risks."],
  ["delivereeos_mbr_summary", "Generate MBR Summary", "Draft an executive monthly business review from real records."],
];

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timestampMillis(value: any) {
  if (value?.seconds) return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  if (typeof value === "number") return value;
  return 0;
}

function scoreInitiative(item: any) {
  const weight = (value: string, positive = true) => {
    const scores: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const raw = scores[value] || 2;
    return positive ? raw : 5 - raw;
  };
  const valueScore =
    weight(item.urgency, true) +
    weight(item.strategicAlignment, true) +
    weight(item.reusability, true) +
    weight(item.risk, false) +
    weight(item.complexity, false);
  const decision =
    valueScore >= 14 ? "go" : valueScore >= 11 ? "conditional_go" : valueScore >= 8 ? "needs_more_info" : "no_go";
  return {
    valueScore,
    recommendedDecision: decision,
    decisionReason:
      decision === "go"
        ? "Strong alignment and reuse potential with manageable delivery risk."
        : decision === "conditional_go"
          ? "Worth pursuing if missing requirements, owners, and support readiness are clarified."
          : decision === "needs_more_info"
            ? "More business, compliance, or effort detail is needed before approval."
            : "Current risk/complexity appears too high for the stated value.",
  };
}

function openBoldi(message: string) {
  window.dispatchEvent(new CustomEvent("open-boldi-assistant", { detail: { message } }));
}

function StatCard({ label, value, detail, icon: Icon }: { label: string; value: any; detail: string; icon: any }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-black text-gray-950">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{detail}</p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-2.5 text-gray-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-gray-200 bg-white/70 p-8 text-center">
      <p className="text-sm font-black text-gray-900">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-gray-500">{copy}</p>
    </div>
  );
}

export function DeliveryOS() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { user, workspace } = useAuth();
  const activeTab = (tabs.some((item) => item.id === tab) ? tab : "overview") as DeliveryTab;

  const [loading, setLoading] = useState(true);
  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [supportCases, setSupportCases] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const [initiativeDraft, setInitiativeDraft] = useState({
    title: "",
    clientName: "",
    businessProblem: "",
    expectedBusinessImpact: "",
    urgency: "medium",
    strategicAlignment: "medium",
    complexity: "medium",
    risk: "medium",
    reusability: "medium",
  });
  const [promptDraft, setPromptDraft] = useState({
    title: "",
    promptKey: "",
    promptText: "",
    environment: "dev",
    status: "draft",
    linkedProjectId: "",
  });
  const [artifactDraft, setArtifactDraft] = useState({
    name: "",
    artifactType: "agent",
    environment: "dev",
    status: "draft",
    ownerId: "",
    linkedProjectId: "",
    supportTier: "none",
    hermesHarnessId: "",
    hermesUrl: "",
  });
  const [supportDraft, setSupportDraft] = useState({
    title: "",
    description: "",
    tier: "tier_1",
    severity: "medium",
    aiArtifactId: "",
    linkedProjectId: "",
  });
  const [hermesDraft, setHermesDraft] = useState({ baseUrl: "", lastError: "" });

  useEffect(() => {
    if (!user || !workspace) return;
    const listeners = [
      onSnapshot(
        query(collection(db, "ai_initiatives"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id)),
        (snap) => setInitiatives(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
      ),
      onSnapshot(
        query(collection(db, "projects"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id)),
        (snap) => setProjects(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
      ),
      onSnapshot(
        query(collection(db, "prompt_assets"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id)),
        (snap) => setPrompts(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
      ),
      onSnapshot(
        query(collection(db, "ai_artifacts"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id)),
        (snap) => setArtifacts(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
      ),
      onSnapshot(
        query(collection(db, "support_cases"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id)),
        (snap) => setSupportCases(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
      ),
      onSnapshot(
        query(collection(db, "delivery_reviews"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id)),
        (snap) => setReviews(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
      ),
      onSnapshot(
        query(collection(db, "integration_configs"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id)),
        (snap) => setIntegrations(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
      ),
    ];
    setLoading(false);
    return () => listeners.forEach((unsubscribe) => unsubscribe());
  }, [user, workspace]);

  const sortedInitiatives = useMemo(
    () => [...initiatives].sort((a, b) => timestampMillis(b.updatedAt || b.createdAt) - timestampMillis(a.updatedAt || a.createdAt)),
    [initiatives],
  );
  const deliveryProjects = projects.filter((project) => project.deliveryOsEnabled);
  const productionArtifacts = artifacts.filter((artifact) => artifact.environment === "production" || artifact.status === "active");
  const atRiskProjects = deliveryProjects.filter((project) => ["blocked", "at_risk"].includes(project.health) || project.supportReadiness === "blocked");
  const hermesConfig = integrations.find((item) => item.integrationKey === "hermes_harness");
  const healthIssues = useMemo(() => {
    const issues: Array<{ severity: "critical" | "warning"; title: string; detail: string }> = [];
    productionArtifacts.forEach((artifact) => {
      if ((artifact.linkedRunbookIds || []).length === 0) {
        issues.push({ severity: "critical", title: `${artifact.name} has no runbook`, detail: "Production AI artifacts need a runbook before support handoff." });
      }
      if (!artifact.ownerId) {
        issues.push({ severity: "critical", title: `${artifact.name} has no owner`, detail: "Assign an accountable owner for production support." });
      }
      if (artifact.hermesStatus === "connected" && !hermesConfig) {
        issues.push({ severity: "warning", title: `${artifact.name} says Hermes is connected`, detail: "Hermes integration is not configured in this workspace." });
      }
    });
    deliveryProjects.forEach((project) => {
      if (!project.sponsorName) issues.push({ severity: "warning", title: `${project.title} has no sponsor`, detail: "Portfolio governance needs a sponsor." });
      if (project.deliveryStage === "support" && project.supportReadiness !== "ready") {
        issues.push({ severity: "critical", title: `${project.title} is in support without readiness`, detail: "Set support readiness to ready or log the blocker." });
      }
    });
    return issues;
  }, [deliveryProjects, productionArtifacts, hermesConfig]);

  const askBoldi = (task: string) => {
    openBoldi(
      `DelivereeOS request: ${task}. Use only real workspace data. If data is missing, say what is missing. Draft only; do not apply risky changes without approval.`,
    );
  };

  const handleCreateInitiative = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !workspace || !initiativeDraft.title.trim()) return;
    setSaving(true);
    try {
      const score = scoreInitiative(initiativeDraft);
      await addDoc(collection(db, "ai_initiatives"), {
        ...initiativeDraft,
        description: initiativeDraft.businessProblem,
        estimatedEffort: "",
        complianceRequirements: "",
        ...score,
        status: "assessment",
        userId: user.uid,
        workspaceId: workspace.id,
        createdBy: user.uid,
        updatedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setInitiativeDraft({
        title: "",
        clientName: "",
        businessProblem: "",
        expectedBusinessImpact: "",
        urgency: "medium",
        strategicAlignment: "medium",
        complexity: "medium",
        risk: "medium",
        reusability: "medium",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendInitiativeToReview = async (initiative: any) => {
    if (!user || !workspace) return;
    await addDoc(collection(db, "review_candidates"), {
      userId: user.uid,
      workspaceId: workspace.id,
      title: initiative.title,
      type: "ai_initiative",
      status: "pending",
      source: "DelivereeOS",
      sourceType: "ai_initiative",
      sourceId: initiative.id,
      confidence: "High",
      proposed: {
        description: initiative.businessProblem || initiative.description || "",
        businessProblem: initiative.businessProblem || "",
        expectedBusinessImpact: initiative.expectedBusinessImpact || "",
        clientName: initiative.clientName || "",
      },
      why: initiative.decisionReason || "AI initiative requires human review before project conversion.",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const handleConvertToProject = async (initiative: any) => {
    if (!user || !workspace) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "projects"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: initiative.title,
        description: initiative.businessProblem || initiative.description || "",
        status: "open",
        projectType: "implementation",
        deliveryOsEnabled: true,
        initiativeId: initiative.id,
        deliveryStage: "planning",
        portfolioPriority: initiative.recommendedDecision === "go" ? "P1" : "P2",
        sponsorName: initiative.sponsorName || initiative.requesterName || "",
        supportTier: "none",
        productionReadiness: "not_started",
        observabilityStatus: "not_configured",
        supportReadiness: "not_started",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "ai_initiatives", initiative.id), {
        status: "converted_to_project",
        linkedProjectId: ref.id,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
      navigate(`/work/projects/${ref.id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePrompt = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !workspace || !promptDraft.title.trim()) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "prompt_assets"), {
        ...promptDraft,
        ownerId: user.uid,
        version: 1,
        userId: user.uid,
        workspaceId: workspace.id,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "prompt_versions"), {
        userId: user.uid,
        workspaceId: workspace.id,
        promptAssetId: ref.id,
        version: 1,
        promptText: promptDraft.promptText,
        changeReason: "Initial DelivereeOS prompt asset.",
        expectedImpact: "Create a governed baseline version.",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setPromptDraft({ title: "", promptKey: "", promptText: "", environment: "dev", status: "draft", linkedProjectId: "" });
    } finally {
      setSaving(false);
    }
  };

  const handleVersionPrompt = async (prompt: any) => {
    if (!user || !workspace) return;
    const changeReason = window.prompt("Change reason for the next prompt version:");
    if (!changeReason) return;
    const nextVersion = Number(prompt.version || 1) + 1;
    await addDoc(collection(db, "prompt_versions"), {
      userId: user.uid,
      workspaceId: workspace.id,
      promptAssetId: prompt.id,
      version: nextVersion,
      promptText: prompt.promptText || "",
      changeReason,
      expectedImpact: "Review before production promotion.",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "prompt_assets", prompt.id), {
      version: nextVersion,
      status: prompt.status === "production" ? "review" : prompt.status,
      updatedAt: serverTimestamp(),
    });
  };

  const handleCreateArtifact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !workspace || !artifactDraft.name.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "ai_artifacts"), {
        ...artifactDraft,
        description: "",
        dependencies: [],
        linkedPromptIds: [],
        linkedRunbookIds: [],
        linkedKnowledgeItemIds: [],
        ownerId: artifactDraft.ownerId || user.uid,
        hermesStatus: artifactDraft.hermesHarnessId ? "unknown" : "not_connected",
        userId: user.uid,
        workspaceId: workspace.id,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setArtifactDraft({
        name: "",
        artifactType: "agent",
        environment: "dev",
        status: "draft",
        ownerId: "",
        linkedProjectId: "",
        supportTier: "none",
        hermesHarnessId: "",
        hermesUrl: "",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSupportCase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !workspace || !supportDraft.title.trim()) return;
    await addDoc(collection(db, "support_cases"), {
      ...supportDraft,
      status: "open",
      ownerId: user.uid,
      userId: user.uid,
      workspaceId: workspace.id,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setSupportDraft({ title: "", description: "", tier: "tier_1", severity: "medium", aiArtifactId: "", linkedProjectId: "" });
  };

  const handleGenerateReview = async (reviewType: "weekly" | "mbr") => {
    if (!user || !workspace) return;
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - (reviewType === "weekly" ? 7 : 30));
    const risks = healthIssues.map((issue) => `${issue.severity.toUpperCase()}: ${issue.title}`).slice(0, 8);
    await addDoc(collection(db, "delivery_reviews"), {
      userId: user.uid,
      workspaceId: workspace.id,
      reviewType,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: now.toISOString().slice(0, 10),
      title: `${reviewType === "weekly" ? "Weekly" : "MBR"} DelivereeOS Review — ${now.toISOString().slice(0, 10)}`,
      executiveSummary:
        deliveryProjects.length === 0
          ? "Not enough data: no DelivereeOS-enabled projects yet."
          : `${deliveryProjects.length} AI delivery projects, ${productionArtifacts.length} production artifacts, ${supportCases.length} support cases, ${risks.length} readiness risks.`,
      portfolioHealth: atRiskProjects.length ? "At-risk items need review." : "No at-risk Delivery OS projects flagged.",
      newOpportunities: sortedInitiatives.slice(0, 5).map((item) => item.title),
      risks,
      delays: deliveryProjects.filter((project) => project.deliveryStage === "uat").map((project) => project.title),
      escalations: supportCases.filter((item) => ["high", "critical"].includes(item.severity)).map((item) => item.title),
      supportHealth: supportCases.length ? `${supportCases.length} open or recent support cases.` : "Not enough support data yet.",
      aiPerformanceSummary: "Not enough automated observability data. Add manual weekly QA snapshots or connect Hermes Harness later.",
      capacityConstraints: healthIssues.filter((item) => item.severity === "critical").map((item) => item.title),
      generatedBy: "user",
      sourceProjectIds: deliveryProjects.map((project) => project.id),
      sourceArtifactIds: artifacts.map((artifact) => artifact.id),
      sourceSupportCaseIds: supportCases.map((item) => item.id),
      status: "draft",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const handleSaveHermesConfig = async () => {
    if (!user || !workspace) return;
    const payload = {
      userId: user.uid,
      workspaceId: workspace.id,
      integrationKey: "hermes_harness",
      status: "not_configured",
      baseUrl: hermesDraft.baseUrl,
      authType: "",
      secretConfigured: false,
      lastHealthCheckAt: null,
      lastError: hermesDraft.lastError || "Backend connector is not implemented yet.",
      createdBy: user.uid,
      updatedAt: serverTimestamp(),
    };
    if (hermesConfig) {
      await updateDoc(doc(db, "integration_configs", hermesConfig.id), payload);
    } else {
      await addDoc(collection(db, "integration_configs"), { ...payload, createdAt: serverTimestamp() });
    }
  };

  const handleCreateStarters = async () => {
    if (!user || !workspace) return;
    setSaving(true);
    try {
      const [skillSnap, playbookSnap] = await Promise.all([
        getDocs(query(collection(db, "skills"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id))),
        getDocs(query(collection(db, "playbooks"), where("userId", "==", user.uid), where("workspaceId", "==", workspace.id))),
      ]);
      const existingSkillKeys = new Set(skillSnap.docs.map((item) => item.data().delivereeOSStarterKey).filter(Boolean));
      const existingPlaybookKeys = new Set(playbookSnap.docs.map((item) => item.data().delivereeOSStarterKey).filter(Boolean));
      await Promise.all([
        ...starterSkills
          .filter(([key]) => !existingSkillKeys.has(key))
          .map(([key, title, purpose]) =>
            addDoc(collection(db, "skills"), {
              userId: user.uid,
              workspaceId: workspace.id,
              title,
              category: "DelivereeOS",
              outputFormat: "Markdown",
              content: purpose,
              systemInstructions: `${purpose}\nUse real workspace data only. Draft outputs and send risky actions to Needs Review.`,
              delivereeOSStarterKey: key,
              createdBy: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }),
          ),
        ...starterPlaybooks
          .filter(([key]) => !existingPlaybookKeys.has(key))
          .map(([key, title, objective]) =>
            addDoc(collection(db, "playbooks"), {
              userId: user.uid,
              workspaceId: workspace.id,
              title,
              category: "DelivereeOS",
              objective,
              content: objective,
              steps: [
                { id: "step_1", title: "Clarify source data", description: "Use existing projects, tasks, docs, prompts, artifacts, and support cases." },
                { id: "step_2", title: "Identify gaps", description: "Show missing owners, runbooks, observability, approvals, and support readiness." },
                { id: "step_3", title: "Draft next action", description: "Create an editable recommendation or send it to Needs Review." },
              ],
              checklistItems: [],
              requiredInputs: [],
              expectedOutputs: [],
              delivereeOSStarterKey: key,
              createdBy: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }),
          ),
      ]);
    } finally {
      setSaving(false);
    }
  };

  const filteredProjects = deliveryProjects.filter((project) => !search || String(project.title || "").toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="grid min-h-[360px] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="gazelle-integrated-page mx-auto w-full max-w-7xl space-y-6 p-4 pb-28"
      initial={{ opacity: 0, y: 10 }}
    >
      <header className="overflow-hidden rounded-[28px] border border-gray-200 bg-[#11140f] p-5 text-white shadow-sm md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-200">Work / AI Delivery Operating System</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">DelivereeOS</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
              Govern AI initiatives from idea to intake, delivery, UAT, production, support, observability, and executive review without duplicating Projects, Action Board, Second Brain, Skills, Playbooks, or Gazelle.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-xl bg-white px-4 py-2 text-xs font-black text-gray-950" onClick={() => navigate("/work/delivery-os/intake")}>
              New opportunity
            </button>
            <button className="rounded-xl border border-white/20 px-4 py-2 text-xs font-black text-white" onClick={() => askBoldi("Summarize DelivereeOS risks and next actions")}>
              Ask Gazelle
            </button>
          </div>
        </div>
      </header>

      <nav className="-mx-4 flex gap-2 overflow-x-auto border-b border-gray-100 px-4 pb-3 md:mx-0 md:px-0">
        {tabs.map((item) => (
          <button
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black transition-all ${
              activeTab === item.id ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
            key={item.id}
            onClick={() => navigate(`/work/delivery-os/${item.id}`)}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="New opportunities" value={initiatives.filter((item) => !["converted_to_project", "archived", "rejected"].includes(item.status)).length} detail="Intake records needing decision" icon={ClipboardCheck} />
            <StatCard label="Active AI projects" value={deliveryProjects.filter((project) => !["archived", "done"].includes(project.status)).length} detail="Existing projects with Delivery OS enabled" icon={Briefcase} />
            <StatCard label="Production artifacts" value={productionArtifacts.length} detail="AI assets needing support ownership" icon={Boxes} />
            <StatCard label="Readiness gaps" value={healthIssues.length} detail="Critical and warning checks" icon={AlertTriangle} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_0.8fr]">
            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-gray-950">Portfolio by delivery stage</h2>
                  <p className="mt-1 text-xs text-gray-500">Uses the existing projects collection. No duplicate project database.</p>
                </div>
                <Link className="text-xs font-black text-indigo-600 hover:underline" to="/work/projects">
                  Projects & Deals
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
                {deliveryStages.map((stage) => (
                  <button
                    className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-left hover:border-gray-300"
                    key={stage}
                    onClick={() => navigate("/work/delivery-os/portfolio")}
                  >
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{titleCase(stage)}</p>
                    <p className="mt-2 text-2xl font-black text-gray-950">{deliveryProjects.filter((project) => (project.deliveryStage || "idea") === stage).length}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-black text-gray-950">DelivereeOS Health Check</h2>
              <div className="mt-4 space-y-2">
                {healthIssues.slice(0, 6).map((issue, index) => (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3" key={`${issue.title}-${index}`}>
                    <p className={`text-xs font-black ${issue.severity === "critical" ? "text-red-700" : "text-amber-700"}`}>{issue.title}</p>
                    <p className="mt-1 text-[11px] leading-4 text-gray-500">{issue.detail}</p>
                  </div>
                ))}
                {healthIssues.length === 0 && <EmptyState title="No readiness gaps detected" copy="As you add production artifacts, prompts, and support cases, DelivereeOS will surface missing owners, runbooks, and observability." />}
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === "intake" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <form className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm" onSubmit={handleCreateInitiative}>
            <h2 className="text-base font-black text-gray-950">New AI Initiative</h2>
            <p className="mt-1 text-xs text-gray-500">Capture enough to score the opportunity. The score is a recommendation, not a final decision.</p>
            <div className="mt-5 space-y-3">
              <input className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none focus:border-gray-400" placeholder="Initiative title" value={initiativeDraft.title} onChange={(e) => setInitiativeDraft({ ...initiativeDraft, title: e.target.value })} />
              <input className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400" placeholder="Client / internal team optional" value={initiativeDraft.clientName} onChange={(e) => setInitiativeDraft({ ...initiativeDraft, clientName: e.target.value })} />
              <textarea className="min-h-[96px] w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400" placeholder="Business problem" value={initiativeDraft.businessProblem} onChange={(e) => setInitiativeDraft({ ...initiativeDraft, businessProblem: e.target.value })} />
              <textarea className="min-h-[80px] w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400" placeholder="Expected business impact" value={initiativeDraft.expectedBusinessImpact} onChange={(e) => setInitiativeDraft({ ...initiativeDraft, expectedBusinessImpact: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                {(["urgency", "strategicAlignment", "complexity", "risk", "reusability"] as const).map((field) => (
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400" key={field}>
                    {titleCase(field)}
                    <select className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700" value={initiativeDraft[field]} onChange={(e) => setInitiativeDraft({ ...initiativeDraft, [field]: e.target.value })}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      {field === "urgency" && <option value="critical">Critical</option>}
                    </select>
                  </label>
                ))}
              </div>
              <button disabled={saving || !initiativeDraft.title.trim()} className="w-full rounded-2xl bg-black px-4 py-3 text-xs font-black text-white disabled:opacity-40">
                Score and save initiative
              </button>
            </div>
          </form>

          <section className="space-y-3">
            {sortedInitiatives.map((initiative) => (
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm" key={initiative.id}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{initiative.clientName || "AI Opportunity"}</p>
                    <h3 className="mt-1 text-lg font-black text-gray-950">{initiative.title}</h3>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{initiative.businessProblem || initiative.description || "No problem statement yet."}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black uppercase text-gray-700">{titleCase(initiative.recommendedDecision || "needs_more_info")}</span>
                </div>
                <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">{initiative.decisionReason || "Score this initiative to generate a decision recommendation."}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-xl bg-black px-3 py-2 text-xs font-black text-white" onClick={() => handleConvertToProject(initiative)}>Convert to project</button>
                  <button className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700" onClick={() => handleSendInitiativeToReview(initiative)}>Send to Needs Review</button>
                  <button className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700" onClick={() => askBoldi(`Improve the business case for AI initiative "${initiative.title}"`)}>Ask Gazelle</button>
                </div>
              </div>
            ))}
            {sortedInitiatives.length === 0 && <EmptyState title="No AI initiatives yet" copy="Start with one opportunity. Keep raw notes editable and let DelivereeOS score without making the final decision for you." />}
          </section>
        </div>
      )}

      {activeTab === "portfolio" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-black text-gray-950">AI Portfolio Board</h2>
              <p className="text-xs text-gray-500">Existing projects with Delivery OS fields enabled.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input className="rounded-2xl border border-gray-200 py-2 pl-9 pr-3 text-xs outline-none" placeholder="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="grid min-w-full grid-cols-1 gap-3 xl:grid-cols-3">
            {deliveryStages.filter((stage) => stage !== "archived").map((stage) => (
              <div className="rounded-3xl border border-gray-200 bg-white p-3 shadow-sm" key={stage}>
                <p className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-400">{titleCase(stage)}</p>
                <div className="mt-2 space-y-2">
                  {filteredProjects.filter((project) => (project.deliveryStage || "idea") === stage).map((project) => (
                    <Link className="block rounded-2xl border border-gray-100 bg-gray-50 p-3 hover:border-gray-300" key={project.id} to={`/work/projects/${project.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-black text-gray-950">{project.title}</p>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-gray-500">{project.portfolioPriority || "No P"}</span>
                      </div>
                      <p className="mt-2 text-[11px] text-gray-500">Support: {titleCase(project.supportReadiness || "not_started")} · Observability: {titleCase(project.observabilityStatus || "not_configured")}</p>
                    </Link>
                  ))}
                  {filteredProjects.filter((project) => (project.deliveryStage || "idea") === stage).length === 0 && <p className="px-2 py-5 text-center text-[11px] text-gray-400">No projects</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "delivery" && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {deliveryProjects.map((project) => (
            <Link className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm hover:border-gray-300" key={project.id} to={`/work/projects/${project.id}`}>
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{titleCase(project.deliveryStage || "idea")}</p>
              <h3 className="mt-1 text-lg font-black text-gray-950">{project.title}</h3>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[10px] font-black text-gray-400">Prod</p><p className="mt-1 text-xs font-black">{titleCase(project.productionReadiness || "not_started")}</p></div>
                <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[10px] font-black text-gray-400">Support</p><p className="mt-1 text-xs font-black">{titleCase(project.supportReadiness || "not_started")}</p></div>
                <div className="rounded-2xl bg-gray-50 p-3"><p className="text-[10px] font-black text-gray-400">Obs</p><p className="mt-1 text-xs font-black">{titleCase(project.observabilityStatus || "not_configured")}</p></div>
              </div>
            </Link>
          ))}
          {deliveryProjects.length === 0 && <EmptyState title="No Delivery OS projects yet" copy="Convert an initiative or enable Delivery OS on an existing project to see gates, roles, readiness, prompts, and artifacts here." />}
        </section>
      )}

      {activeTab === "promptops" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <form className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm" onSubmit={handleCreatePrompt}>
            <h2 className="text-base font-black text-gray-950">Prompt Asset</h2>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold" placeholder="Prompt title" value={promptDraft.title} onChange={(e) => setPromptDraft({ ...promptDraft, title: e.target.value })} />
              <input className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" placeholder="prompt_key" value={promptDraft.promptKey} onChange={(e) => setPromptDraft({ ...promptDraft, promptKey: e.target.value })} />
              <textarea className="min-h-[140px] w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" placeholder="Prompt text" value={promptDraft.promptText} onChange={(e) => setPromptDraft({ ...promptDraft, promptText: e.target.value })} />
              <select className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" value={promptDraft.linkedProjectId} onChange={(e) => setPromptDraft({ ...promptDraft, linkedProjectId: e.target.value })}>
                <option value="">No linked project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
              <button className="w-full rounded-2xl bg-black px-4 py-3 text-xs font-black text-white">Create governed prompt</button>
            </div>
          </form>
          <section className="space-y-3">
            {prompts.map((prompt) => (
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm" key={prompt.id}>
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-base font-black text-gray-950">{prompt.title}</h3><p className="mt-1 text-xs text-gray-500">{prompt.promptKey || "No key"} · v{prompt.version || 1} · {prompt.environment}</p></div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black uppercase text-gray-700">{prompt.status}</span>
                </div>
                <p className="mt-3 line-clamp-3 rounded-2xl bg-gray-50 p-3 text-xs leading-5 text-gray-600">{prompt.promptText || "No prompt text yet."}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black" onClick={() => handleVersionPrompt(prompt)}>Create version</button>
                  <button className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black" onClick={() => askBoldi(`Generate prompt QA checklist for "${prompt.title}"`)}>QA checklist</button>
                </div>
              </div>
            ))}
            {prompts.length === 0 && <EmptyState title="No prompt assets yet" copy="Create a prompt as a governed asset. Production changes create versions instead of overwriting history." />}
          </section>
        </div>
      )}

      {activeTab === "artifacts" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <form className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm" onSubmit={handleCreateArtifact}>
            <h2 className="text-base font-black text-gray-950">Register AI Artifact</h2>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold" placeholder="Artifact name" value={artifactDraft.name} onChange={(e) => setArtifactDraft({ ...artifactDraft, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <select className="rounded-2xl border border-gray-200 px-3 py-3 text-sm" value={artifactDraft.artifactType} onChange={(e) => setArtifactDraft({ ...artifactDraft, artifactType: e.target.value })}>
                  {["agent", "bot", "voice_bot", "rag_system", "prompt_library", "knowledge_base", "automation_workflow", "integration", "evaluation_harness", "other"].map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
                </select>
                <select className="rounded-2xl border border-gray-200 px-3 py-3 text-sm" value={artifactDraft.environment} onChange={(e) => setArtifactDraft({ ...artifactDraft, environment: e.target.value })}>
                  {["dev", "qa", "uat", "production"].map((env) => <option key={env} value={env}>{env.toUpperCase()}</option>)}
                </select>
              </div>
              <select className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" value={artifactDraft.linkedProjectId} onChange={(e) => setArtifactDraft({ ...artifactDraft, linkedProjectId: e.target.value })}>
                <option value="">No linked project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
              <input className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" placeholder="Manual Hermes ID, if known" value={artifactDraft.hermesHarnessId} onChange={(e) => setArtifactDraft({ ...artifactDraft, hermesHarnessId: e.target.value })} />
              <button className="w-full rounded-2xl bg-black px-4 py-3 text-xs font-black text-white">Register artifact</button>
            </div>
          </form>
          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {artifacts.map((artifact) => (
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm" key={artifact.id}>
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{titleCase(artifact.artifactType || "artifact")}</p>
                <h3 className="mt-1 text-base font-black text-gray-950">{artifact.name}</h3>
                <div className="mt-3 space-y-1 text-xs text-gray-500">
                  <p>Environment: <b>{artifact.environment}</b></p>
                  <p>Support tier: <b>{titleCase(artifact.supportTier || "none")}</b></p>
                  <p>Hermes: <b>{artifact.hermesHarnessId ? "Manual ID stored" : "Not connected"}</b></p>
                </div>
                <button className="mt-4 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black" onClick={() => askBoldi(`Identify missing support metadata for artifact "${artifact.name}"`)}>Find gaps</button>
              </div>
            ))}
            {artifacts.length === 0 && <EmptyState title="No AI artifacts yet" copy="Register agents, bots, RAG systems, prompt libraries, automations, or evaluation harnesses. Hermes remains manual unless configured." />}
          </section>
        </div>
      )}

      {activeTab === "support" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <form className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm" onSubmit={handleCreateSupportCase}>
            <h2 className="text-base font-black text-gray-950">New Support Case</h2>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold" placeholder="Case title" value={supportDraft.title} onChange={(e) => setSupportDraft({ ...supportDraft, title: e.target.value })} />
              <textarea className="min-h-[100px] w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" placeholder="Issue description" value={supportDraft.description} onChange={(e) => setSupportDraft({ ...supportDraft, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <select className="rounded-2xl border border-gray-200 px-3 py-3 text-sm" value={supportDraft.tier} onChange={(e) => setSupportDraft({ ...supportDraft, tier: e.target.value })}>{["tier_1", "tier_2", "tier_3"].map((tier) => <option key={tier} value={tier}>{titleCase(tier)}</option>)}</select>
                <select className="rounded-2xl border border-gray-200 px-3 py-3 text-sm" value={supportDraft.severity} onChange={(e) => setSupportDraft({ ...supportDraft, severity: e.target.value })}>{["low", "medium", "high", "critical"].map((severity) => <option key={severity} value={severity}>{titleCase(severity)}</option>)}</select>
              </div>
              <select className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" value={supportDraft.aiArtifactId} onChange={(e) => setSupportDraft({ ...supportDraft, aiArtifactId: e.target.value })}>
                <option value="">No linked artifact</option>
                {artifacts.map((artifact) => <option key={artifact.id} value={artifact.id}>{artifact.name}</option>)}
              </select>
              <button className="w-full rounded-2xl bg-black px-4 py-3 text-xs font-black text-white">Create support case</button>
            </div>
          </form>
          <section className="space-y-3">
            {supportCases.map((supportCase) => (
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm" key={supportCase.id}>
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-base font-black text-gray-950">{supportCase.title}</h3><p className="mt-1 text-xs text-gray-500">{titleCase(supportCase.tier)} · {titleCase(supportCase.severity)}</p></div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black uppercase text-gray-700">{supportCase.status}</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-gray-500">{supportCase.description || "No description."}</p>
                <button className="mt-4 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black" onClick={() => askBoldi(`Generate client update and tier escalation recommendation for support case "${supportCase.title}"`)}>Draft update</button>
              </div>
            ))}
            {supportCases.length === 0 && <EmptyState title="No support cases yet" copy="Create cases manually. Hermes incidents can be linked later when the connector exists." />}
          </section>
        </div>
      )}

      {activeTab === "reviews" && (
        <section className="space-y-4">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-gray-950">Executive Reviews</h2>
            <p className="mt-1 text-xs text-gray-500">Drafts are generated from real DelivereeOS records. Missing metrics are stated honestly.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-xl bg-black px-4 py-2 text-xs font-black text-white" onClick={() => handleGenerateReview("weekly")}>Generate Weekly Review Draft</button>
              <button className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-black text-gray-700" onClick={() => handleGenerateReview("mbr")}>Generate MBR Draft</button>
              <button className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-black text-gray-700" onClick={() => askBoldi("Generate an executive review narrative from DelivereeOS records")}>Ask Gazelle</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {reviews.map((review) => (
              <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm" key={review.id}>
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{review.reviewType}</p>
                <h3 className="mt-1 text-base font-black text-gray-950">{review.title}</h3>
                <p className="mt-3 text-xs leading-5 text-gray-600">{review.executiveSummary}</p>
                <p className="mt-3 text-[11px] text-gray-400">Status: {review.status}</p>
              </article>
            ))}
            {reviews.length === 0 && <EmptyState title="No review drafts yet" copy="Generate a Weekly Review or MBR draft after adding initiatives, projects, artifacts, and support cases." />}
          </div>
        </section>
      )}

      {activeTab === "integrations" && (
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-gray-950">Hermes Harness</h2>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              Planned / Not connected. DelivereeOS can store manual Hermes IDs and URLs, but live sync, logs, metrics, incidents, and deployment events are not implemented yet.
            </p>
            <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900">
              <b>Status:</b> {titleCase(hermesConfig?.status || "not_configured")} · <b>Secret:</b> {hermesConfig?.secretConfigured ? "Configured" : "Not configured"}
            </div>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" placeholder="Base URL placeholder, if known" value={hermesDraft.baseUrl || hermesConfig?.baseUrl || ""} onChange={(e) => setHermesDraft({ ...hermesDraft, baseUrl: e.target.value })} />
              <input className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" placeholder="Last error / notes" value={hermesDraft.lastError || hermesConfig?.lastError || ""} onChange={(e) => setHermesDraft({ ...hermesDraft, lastError: e.target.value })} />
              <button className="rounded-2xl bg-black px-4 py-3 text-xs font-black text-white" onClick={handleSaveHermesConfig}>Save manual status</button>
            </div>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-gray-950">Knowledge / Skills / Playbooks</h2>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              Starter assets are created in the existing Skills Library and Playbooks. The operation is idempotent and will not duplicate records with the same DelivereeOS starter key.
            </p>
            <button className="mt-4 rounded-2xl border border-gray-200 px-4 py-3 text-xs font-black text-gray-700" disabled={saving} onClick={handleCreateStarters}>
              {saving ? "Creating..." : "Create / verify starter assets"}
            </button>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Link className="rounded-2xl bg-gray-50 p-4 text-xs font-black text-gray-700" to="/capture/documents?tab=skills">Open Skills Library <ArrowRight className="mt-2 h-4 w-4" /></Link>
              <Link className="rounded-2xl bg-gray-50 p-4 text-xs font-black text-gray-700" to="/capture/documents?tab=playbooks">Open Playbooks <ArrowRight className="mt-2 h-4 w-4" /></Link>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-black text-gray-950">Operating rules enforced in the MVP</p>
              <p className="text-xs text-gray-500">Workspace-scoped records, no frontend AI keys, honest integration status, and approval-gated AI drafts.</p>
            </div>
          </div>
          <button className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700" onClick={() => askBoldi("Create missing DelivereeOS runbooks, checklists, and review candidates")}>
            <Sparkles className="mr-1 inline h-3.5 w-3.5" />
            Ask Gazelle for gaps
          </button>
        </div>
      </section>
    </motion.div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { AlertTriangle, Boxes, BrainCircuit, CheckCircle2, ClipboardCheck, ShieldCheck } from "lucide-react";
import { db } from "../lib/firebase";

const gateTypes = [
  "requirements",
  "architecture",
  "development",
  "qa",
  "uat",
  "security",
  "observability",
  "release",
  "rollback",
  "training",
  "production",
  "support_handoff",
];

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ProjectDeliveryOSPanel({
  project,
  user,
  workspace,
  canUpdateProject,
}: {
  project: any;
  user: any;
  workspace: any;
  canUpdateProject: boolean;
}) {
  const [gates, setGates] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !workspace || !project?.id) return;
    const listeners = [
      onSnapshot(
        query(
          collection(db, "delivery_gates"),
          where("userId", "==", user.uid),
          where("workspaceId", "==", workspace.id),
          where("projectId", "==", project.id),
        ),
        (snap) => setGates(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
      ),
      onSnapshot(
        query(
          collection(db, "prompt_assets"),
          where("userId", "==", user.uid),
          where("workspaceId", "==", workspace.id),
          where("linkedProjectId", "==", project.id),
        ),
        (snap) => setPrompts(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
      ),
      onSnapshot(
        query(
          collection(db, "ai_artifacts"),
          where("userId", "==", user.uid),
          where("workspaceId", "==", workspace.id),
          where("linkedProjectId", "==", project.id),
        ),
        (snap) => setArtifacts(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
      ),
    ];
    return () => listeners.forEach((unsubscribe) => unsubscribe());
  }, [user, workspace, project?.id]);

  const readiness = useMemo(() => {
    const required = ["requirements", "uat", "security", "observability", "release", "rollback", "support_handoff"];
    const passed = required.filter((type) => gates.find((gate) => gate.gateType === type && ["passed", "waived"].includes(gate.status))).length;
    return { passed, total: required.length, percent: required.length ? Math.round((passed / required.length) * 100) : 0 };
  }, [gates]);

  const enableDeliveryOS = async () => {
    if (!project?.id || !canUpdateProject) return;
    await updateDoc(doc(db, "projects", project.id), {
      deliveryOsEnabled: true,
      deliveryStage: project.deliveryStage || "planning",
      portfolioPriority: project.portfolioPriority || "P2",
      supportTier: project.supportTier || "none",
      productionReadiness: project.productionReadiness || "not_started",
      observabilityStatus: project.observabilityStatus || "not_configured",
      supportReadiness: project.supportReadiness || "not_started",
      updatedAt: serverTimestamp(),
    });
  };

  const createDefaultGates = async () => {
    if (!user || !workspace || !project?.id || saving) return;
    setSaving(true);
    try {
      const existing = new Set(gates.map((gate) => gate.gateType));
      await Promise.all(
        gateTypes
          .filter((type) => !existing.has(type))
          .map((gateType) =>
            addDoc(collection(db, "delivery_gates"), {
              userId: user.uid,
              workspaceId: workspace.id,
              projectId: project.id,
              gateType,
              status: "not_started",
              ownerId: "",
              dueDate: "",
              evidenceLinks: [],
              notes: "",
              createdBy: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }),
          ),
      );
    } finally {
      setSaving(false);
    }
  };

  const updateGateStatus = async (gate: any, status: string) => {
    await updateDoc(doc(db, "delivery_gates", gate.id), {
      status,
      updatedAt: serverTimestamp(),
      ...(status === "passed" ? { approvedBy: user?.uid || "", approvedAt: serverTimestamp() } : {}),
    });
  };

  const updateProjectField = async (field: string, value: string) => {
    if (!project?.id || !canUpdateProject) return;
    await updateDoc(doc(db, "projects", project.id), { [field]: value, updatedAt: serverTimestamp() });
  };

  if (!project.deliveryOsEnabled) {
    return (
      <section className="rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/60 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">DelivereeOS available</p>
            <h3 className="mt-2 text-xl font-black text-indigo-950">Enable AI delivery governance for this project</h3>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-indigo-900/70">
              This reuses the existing project workspace and adds delivery stage, gates, readiness, linked prompts, artifacts, and support metadata.
            </p>
          </div>
          <button
            className="rounded-2xl bg-indigo-700 px-4 py-3 text-xs font-black text-white disabled:opacity-40"
            disabled={!canUpdateProject}
            onClick={enableDeliveryOS}
          >
            Enable DelivereeOS
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">DelivereeOS Project Workspace</p>
            <h3 className="mt-2 text-2xl font-black text-gray-950">AI delivery readiness</h3>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-gray-500">
              Gates are advisory and evidence-based. They do not block project usage, but they make readiness gaps visible before UAT, production, and support handoff.
            </p>
          </div>
          <Link className="rounded-2xl border border-gray-200 px-4 py-3 text-xs font-black text-gray-700 hover:bg-gray-50" to="/work/delivery-os">
            Open command center
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-gray-50 p-4">
            <ClipboardCheck className="h-5 w-5 text-indigo-600" />
            <p className="mt-2 text-[10px] font-black uppercase text-gray-400">Readiness</p>
            <p className="text-xl font-black text-gray-950">{readiness.percent}%</p>
            <p className="text-[11px] text-gray-500">{readiness.passed}/{readiness.total} key gates passed</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <BrainCircuit className="h-5 w-5 text-amber-600" />
            <p className="mt-2 text-[10px] font-black uppercase text-gray-400">Prompts</p>
            <p className="text-xl font-black text-gray-950">{prompts.length}</p>
            <p className="text-[11px] text-gray-500">Linked governed assets</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            <Boxes className="h-5 w-5 text-purple-600" />
            <p className="mt-2 text-[10px] font-black uppercase text-gray-400">Artifacts</p>
            <p className="text-xl font-black text-gray-950">{artifacts.length}</p>
            <p className="text-[11px] text-gray-500">Linked AI systems</p>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4">
            {project.supportReadiness === "ready" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
            <p className="mt-2 text-[10px] font-black uppercase text-gray-400">Support</p>
            <p className="text-xl font-black text-gray-950">{label(project.supportReadiness || "not_started")}</p>
            <p className="text-[11px] text-gray-500">Tier: {label(project.supportTier || "none")}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            ["deliveryStage", ["idea", "assessment", "approved", "planning", "delivery", "uat", "production", "support", "archived"]],
            ["portfolioPriority", ["P1", "P2", "P3", "P4"]],
            ["productionReadiness", ["not_started", "in_progress", "ready", "blocked"]],
            ["observabilityStatus", ["not_configured", "partial", "active", "degraded"]],
            ["supportReadiness", ["not_started", "in_progress", "ready", "blocked"]],
            ["supportTier", ["none", "tier_1", "tier_2", "tier_3"]],
          ].map(([field, values]: any) => (
            <label className="text-[10px] font-black uppercase tracking-wider text-gray-400" key={field}>
              {label(field)}
              <select
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700"
                disabled={!canUpdateProject}
                onChange={(event) => updateProjectField(field, event.target.value)}
                value={project[field] || values[0]}
              >
                {values.map((value: string) => <option key={value} value={value}>{label(value)}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-black text-gray-950">Delivery gates</h3>
            <p className="mt-1 text-xs text-gray-500">Create the standard AI delivery gate checklist and update each gate as evidence becomes available.</p>
          </div>
          <button className="rounded-2xl bg-black px-4 py-2.5 text-xs font-black text-white" disabled={saving} onClick={createDefaultGates}>
            {gates.length ? "Fill missing gates" : "Create standard gates"}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {gateTypes.map((gateType) => {
            const gate = gates.find((item) => item.gateType === gateType);
            return (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3" key={gateType}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-gray-500" />
                    <p className="text-xs font-black text-gray-900">{label(gateType)}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase text-gray-500">
                    {label(gate?.status || "missing")}
                  </span>
                </div>
                {gate ? (
                  <select
                    className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold"
                    onChange={(event) => updateGateStatus(gate, event.target.value)}
                    value={gate.status}
                  >
                    {["not_started", "in_progress", "passed", "failed", "blocked", "waived"].map((status) => (
                      <option key={status} value={status}>{label(status)}</option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-3 text-[11px] text-gray-400">Not created yet.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-black text-gray-950">Linked delivery assets</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Prompts</p>
            <div className="mt-2 space-y-2">
              {prompts.map((prompt) => <div className="rounded-2xl bg-gray-50 p-3 text-xs font-bold" key={prompt.id}>{prompt.title} · v{prompt.version || 1}</div>)}
              {prompts.length === 0 && <p className="rounded-2xl bg-gray-50 p-3 text-xs text-gray-400">No linked prompts yet.</p>}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Artifacts</p>
            <div className="mt-2 space-y-2">
              {artifacts.map((artifact) => <div className="rounded-2xl bg-gray-50 p-3 text-xs font-bold" key={artifact.id}>{artifact.name} · {label(artifact.environment || "dev")}</div>)}
              {artifacts.length === 0 && <p className="rounded-2xl bg-gray-50 p-3 text-xs text-gray-400">No linked AI artifacts yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

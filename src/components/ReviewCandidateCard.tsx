import { useState } from "react";
import { Check, X, Calendar, AlertCircle, Bookmark, HelpCircle, FileText, Sparkles, Cpu, Clipboard, Briefcase, Link as LinkIcon } from "lucide-react";
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { EntityLinksManager } from "./EntityLinksManager";

interface ReviewCandidateCardProps {
  candidate: any;
  onProcessed: () => void;
}

type DestinationType = "task" | "someday" | "decision" | "knowledge" | "waiting_for" | "skill" | "playbook" | "project";

export function ReviewCandidateCard({ candidate, onProcessed }: ReviewCandidateCardProps) {
  const { user, workspace } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [showLinks, setShowLinks] = useState(false);

  // Editable fields
  const [title, setTitle] = useState(candidate.title || "");
  const [type, setType] = useState<DestinationType>(() => {
    const t = candidate.type?.toLowerCase();
    if (t === "decision") return "decision";
    if (t === "someday" || t === "idea") return "someday";
    if (t === "knowledge" || t === "doc" || t === "knowledge_item") return "knowledge";
    if (t === "waiting_for" || t === "waiting for") return "waiting_for";
    if (t === "skill" || t === "ai_skill") return "skill";
    if (t === "playbook") return "playbook";
    if (t === "project") return "project";
    return "task";
  });

  // Task-specific fields
  const [priority, setPriority] = useState(candidate.proposed?.priority || "medium");
  const [timeSector, setTimeSector] = useState(candidate.proposed?.timeSector || "Today");
  const [dueDate, setDueDate] = useState(
    candidate.proposed?.dueDate || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  
  // Knowledge-specific fields
  const [docType, setDocType] = useState(candidate.proposed?.docType || "reference"); // sop, reference, meeting_note, decision_record, etc.
  const [isAIReadable, setIsAIReadable] = useState(candidate.proposed?.isAIReadable !== false);

  // Skill-specific fields
  const [skillCategory, setSkillCategory] = useState(candidate.proposed?.category || "General");
  const [skillOutput, setSkillOutput] = useState(candidate.proposed?.outputFormat || "Markdown");

  // Playbook-specific fields
  const [playbookCategory, setPlaybookCategory] = useState(candidate.proposed?.category || "Operations");
  const [playbookObjective, setPlaybookObjective] = useState(candidate.proposed?.objective || "");

  // Project-specific fields
  const [projectStage, setProjectStage] = useState("planning");

  // Description / Notes
  const [notes, setNotes] = useState(
    candidate.proposed?.description || candidate.proposed?.notes || candidate.why || ""
  );

  const handleDismiss = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "review_candidates", candidate.id), { status: "killed" });
      onProcessed();
    } catch (err) {
      console.error("Error dismissing candidate:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAndSend = async () => {
    if (!user || !workspace || isSaving) return;
    setIsSaving(true);
    try {
      const basePayload = {
        userId: user.uid,
        workspaceId: workspace.id,
        title: title.trim() || "Untitled Item",
        status: "open",
        reviewItemId: candidate.id,
        source: candidate.source || "Capture",
        sourceType: candidate.sourceType || "triage",
        sourceId: candidate.sourceId || candidate.id,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      let createdRef: any = null;

      if (type === "task") {
        const taskPayload = {
          ...basePayload,
          globalStageId: timeSector === "Today" ? "today" : "next",
          priority: priority,
          dueDate: dueDate || "",
          description: notes.trim(),
          timeSector: timeSector,
        };
        createdRef = await addDoc(collection(db, "tasks"), taskPayload);
      } else if (type === "someday") {
        const somedayPayload = {
          ...basePayload,
          description: notes.trim(),
        };
        createdRef = await addDoc(collection(db, "someday"), somedayPayload);
      } else if (type === "decision") {
        const decisionPayload = {
          ...basePayload,
          description: notes.trim(),
        };
        createdRef = await addDoc(collection(db, "decisions"), decisionPayload);
      } else if (type === "knowledge") {
        const knowledgePayload = {
          ...basePayload,
          content: notes.trim(),
          description: notes.trim(),
          type: "Knowledge",
          docType: docType,
          isAIReadable: isAIReadable,
          backlinkCount: 0,
        };
        createdRef = await addDoc(collection(db, "knowledge_items"), knowledgePayload);
      } else if (type === "waiting_for") {
        const waitingPayload = {
          ...basePayload,
          description: notes.trim(),
        };
        createdRef = await addDoc(collection(db, "waiting_for"), waitingPayload);
      } else if (type === "skill") {
        const skillPayload = {
          ...basePayload,
          content: notes.trim(),
          category: skillCategory,
          outputFormat: skillOutput,
          systemInstructions: notes.trim(),
        };
        createdRef = await addDoc(collection(db, "skills"), skillPayload);
      } else if (type === "playbook") {
        const playbookPayload = {
          ...basePayload,
          content: notes.trim(),
          category: playbookCategory,
          objective: playbookObjective || title,
          steps: [
            {
              id: "step_1",
              title: `Execute initial review of ${title}`,
              description: notes.trim() || "Complete the tasks specified in the initial notes."
            }
          ],
          requiredInputs: [],
          expectedOutputs: [],
          checklistItems: []
        };
        createdRef = await addDoc(collection(db, "playbooks"), playbookPayload);
      } else if (type === "project") {
        const projectPayload = {
          ...basePayload,
          status: projectStage,
          description: notes.trim(),
        };
        createdRef = await addDoc(collection(db, "projects"), projectPayload);
      }

      // Record bidirectional link if created successfully
      if (createdRef) {
        await addDoc(collection(db, "entity_links"), {
          workspaceId: workspace.id,
          fromEntityType: "review_candidates",
          fromEntityId: candidate.id,
          toEntityType: type === "knowledge" ? "knowledge_item" : type,
          toEntityId: createdRef.id,
          relationType: "generated_from",
          createdBy: user.uid,
          createdAt: new Date()
        });
      }

      await updateDoc(doc(db, "review_candidates", candidate.id), { status: "approved" });
      onProcessed();
    } catch (err) {
      console.error("Error approving candidate:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 relative overflow-hidden text-left">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
      
      {/* Header Info */}
      <div className="flex items-center justify-between pl-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
            Needs Review
          </span>
          {candidate.confidence && (
            <span className="text-[9px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded uppercase font-black tracking-wider">
              {candidate.confidence} Confidence
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {candidate.createdAt && (
            <span className="text-[10px] text-gray-400 font-bold">
              {new Date(candidate.createdAt.seconds * 1000).toLocaleDateString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowLinks(!showLinks)}
            className="p-1 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
            title="Toggle connection graph"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showLinks && (
        <div className="pl-2">
          <EntityLinksManager entityType="review_candidates" entityId={candidate.id} />
        </div>
      )}

      {/* Title Field */}
      <div className="space-y-1 pl-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-sm font-bold text-gray-900 bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl p-2.5 focus:outline-none transition-all"
          placeholder="Enter title..."
        />
      </div>

      {/* Segmented Destination Selector */}
      <div className="space-y-1 pl-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Assign Destination</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => setType("task")}
            className={`py-1.5 px-1 rounded-lg text-[9px] font-black flex flex-col items-center gap-1 transition-all ${
              type === "task" ? "bg-white shadow text-indigo-600" : "text-gray-500 hover:text-black"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Task
          </button>
          <button
            type="button"
            onClick={() => setType("someday")}
            className={`py-1.5 px-1 rounded-lg text-[9px] font-black flex flex-col items-center gap-1 transition-all ${
              type === "someday" ? "bg-white shadow text-indigo-600" : "text-gray-500 hover:text-black"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            Idea
          </button>
          <button
            type="button"
            onClick={() => setType("decision")}
            className={`py-1.5 px-1 rounded-lg text-[9px] font-black flex flex-col items-center gap-1 transition-all ${
              type === "decision" ? "bg-white shadow text-indigo-600" : "text-gray-500 hover:text-black"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Decision
          </button>
          <button
            type="button"
            onClick={() => setType("knowledge")}
            className={`py-1.5 px-1 rounded-lg text-[9px] font-black flex flex-col items-center gap-1 transition-all ${
              type === "knowledge" ? "bg-white shadow text-indigo-600" : "text-gray-500 hover:text-black"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Doc
          </button>
          <button
            type="button"
            onClick={() => setType("skill")}
            className={`py-1.5 px-1 rounded-lg text-[9px] font-black flex flex-col items-center gap-1 transition-all ${
              type === "skill" ? "bg-white shadow text-indigo-600" : "text-gray-500 hover:text-black"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Skill
          </button>
          <button
            type="button"
            onClick={() => setType("playbook")}
            className={`py-1.5 px-1 rounded-lg text-[9px] font-black flex flex-col items-center gap-1 transition-all ${
              type === "playbook" ? "bg-white shadow text-indigo-600" : "text-gray-500 hover:text-black"
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            Playbook
          </button>
          <button
            type="button"
            onClick={() => setType("project")}
            className={`py-1.5 px-1 rounded-lg text-[9px] font-black flex flex-col items-center gap-1 transition-all ${
              type === "project" ? "bg-white shadow text-indigo-600" : "text-gray-500 hover:text-black"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Project
          </button>
          <button
            type="button"
            onClick={() => setType("waiting_for")}
            className={`py-1.5 px-1 rounded-lg text-[9px] font-black flex flex-col items-center gap-1 transition-all ${
              type === "waiting_for" ? "bg-white shadow text-indigo-600" : "text-gray-500 hover:text-black"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Wait For
          </button>
        </div>
      </div>

      {/* Task-specific Configuration Section */}
      {type === "task" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-indigo-50/40 p-3 rounded-2xl border border-indigo-100/50 pl-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="high">High (P1)</option>
              <option value="medium">Medium (P2)</option>
              <option value="low">Low (P3)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block">Time Sector</label>
            <select
              value={timeSector}
              onChange={(e) => setTimeSector(e.target.value)}
              className="w-full text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
              <option value="Next Week">Next Week</option>
              <option value="This Month">This Month</option>
              <option value="Next Month">Next Month</option>
              <option value="Later">Later</option>
            </select>
          </div>
        </div>
      )}

      {/* Doc-specific Configuration Section */}
      {type === "knowledge" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-teal-50/40 p-3 rounded-2xl border border-teal-100/50 pl-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-teal-600 uppercase tracking-wider block">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="reference">Reference Article</option>
              <option value="sop">SOP (Standard Procedure)</option>
              <option value="meeting_note">Meeting Note</option>
              <option value="decision_record">Decision Record</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="ai_read"
              checked={isAIReadable}
              onChange={(e) => setIsAIReadable(e.target.checked)}
              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
            />
            <label htmlFor="ai_read" className="text-xs font-semibold text-gray-700">AI Second Brain Indexable</label>
          </div>
        </div>
      )}

      {/* Skill-specific Configuration Section */}
      {type === "skill" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/40 p-3 rounded-2xl border border-amber-100/50 pl-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block">Skill Category</label>
            <input
              type="text"
              value={skillCategory}
              onChange={(e) => setSkillCategory(e.target.value)}
              className="w-full text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="e.g. Marketing, Code, Writing"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block">Output Format</label>
            <input
              type="text"
              value={skillOutput}
              onChange={(e) => setSkillOutput(e.target.value)}
              className="w-full text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="e.g. Markdown, JSON, Checklist"
            />
          </div>
        </div>
      )}

      {/* Playbook-specific Configuration Section */}
      {type === "playbook" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-emerald-50/40 p-3 rounded-2xl border border-emerald-100/50 pl-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">Playbook Category</label>
            <input
              type="text"
              value={playbookCategory}
              onChange={(e) => setPlaybookCategory(e.target.value)}
              className="w-full text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="e.g. Client Onboarding, Release"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block">Strategic Objective</label>
            <input
              type="text"
              value={playbookObjective}
              onChange={(e) => setPlaybookObjective(e.target.value)}
              className="w-full text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Primary objective..."
            />
          </div>
        </div>
      )}

      {/* Project-specific Configuration Section */}
      {type === "project" && (
        <div className="grid grid-cols-1 gap-3 bg-purple-50/40 p-3 rounded-2xl border border-purple-100/50 pl-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-purple-600 uppercase tracking-wider block">Initial Project Stage</label>
            <select
              value={projectStage}
              onChange={(e) => setProjectStage(e.target.value)}
              className="w-full text-xs font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="planning">GTD Planning</option>
              <option value="active">Active Execution</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
        </div>
      )}

      {/* Description / Notes */}
      <div className="space-y-1 pl-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
          {type === "skill" ? "System Instructions (Prompt Template)" : type === "playbook" ? "Playbook Details & Steps Context" : "Description / Notes"}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full text-xs bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl p-2.5 focus:outline-none transition-all resize-none font-medium text-gray-700 leading-relaxed"
          placeholder="Add context, specifications, or notes here..."
        />
      </div>

      {/* Raw Source Context */}
      {candidate.source && (
        <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 pl-3">
          <p className="text-[9px] text-gray-400 font-bold mb-1 uppercase tracking-wider">Captured Source Input:</p>
          <p className="text-[11px] text-gray-600 italic line-clamp-2 leading-relaxed">
            "{candidate.source}"
          </p>
        </div>
      )}

      {/* Control Actions */}
      <div className="flex gap-2.5 mt-2 pl-2">
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isSaving}
          className="flex-1 py-2.5 text-xs font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-100 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          <X className="w-4 h-4" />
          Dismiss
        </button>
        <button
          type="button"
          onClick={handleApproveAndSend}
          disabled={isSaving}
          className="flex-1 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-100 disabled:opacity-50 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          Approve & Send
        </button>
      </div>
    </div>
  );
}

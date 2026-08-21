import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Gem,
  Gift,
  Link2,
  Plus,
  Sparkles,
  Target,
  Trophy,
  Users,
  X,
} from "./ui/Icon";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { memberLabel as publicMemberLabel, type WorkspaceMember } from "../lib/workspaceCollaboration";
import { AiRewriteButton } from "./AiRewriteButton";
import {
  canAwardBoost,
  gemBalance,
  linkedWorkProgress,
  objectiveHealth,
  objectiveProgress,
  strategyCycleLabel,
} from "../lib/strategyExecution";

type StrategyTab = "scoreboard" | "plan" | "rewards";
type MeasureKind = "outcome" | "lead";

function itemTitle(item: any) {
  return String(item?.title || item?.name || "Untitled");
}

function workType(item: any) {
  return String(item?.workItemType || item?.type || item?.itemType || "task").toLowerCase();
}

function memberLabel(member?: WorkspaceMember | null) {
  return member ? publicMemberLabel(member) : "Unassigned";
}

function quarterEnd(date = new Date()) {
  const endMonth = Math.floor(date.getMonth() / 3) * 3 + 3;
  return new Date(date.getFullYear(), endMonth, 0).toISOString().slice(0, 10);
}

function statusLabel(value: string) {
  if (value === "done") return "Achieved";
  if (value === "off_track") return "Off track";
  if (value === "at_risk") return "At risk";
  return "On track";
}

export function StrategyCenter({
  goals,
  keyResults,
  records,
  projects,
  tasks,
  workspaceMembers,
  onAsk,
}: {
  goals: any[];
  keyResults: any[];
  records: any[];
  projects: any[];
  tasks: any[];
  workspaceMembers: WorkspaceMember[];
  onAsk: (prompt: string) => void;
}) {
  const { user, workspace } = useAuth();
  const [tab, setTab] = useState<StrategyTab>("scoreboard");
  const [notice, setNotice] = useState("");
  const [showObjectiveForm, setShowObjectiveForm] = useState(false);
  const [objectiveTitle, setObjectiveTitle] = useState("");
  const [objectiveDescription, setObjectiveDescription] = useState("");
  const [objectiveType, setObjectiveType] = useState("committed");
  const [objectiveCycle, setObjectiveCycle] = useState(strategyCycleLabel());
  const [objectiveOwnerId, setObjectiveOwnerId] = useState("");
  const [objectiveEnd, setObjectiveEnd] = useState(quarterEnd());
  const [measureGoalId, setMeasureGoalId] = useState<string | null>(null);
  const [measureKind, setMeasureKind] = useState<MeasureKind>("outcome");
  const [measureTitle, setMeasureTitle] = useState("");
  const [measureStart, setMeasureStart] = useState(0);
  const [measureCurrent, setMeasureCurrent] = useState(0);
  const [measureTarget, setMeasureTarget] = useState(100);
  const [measureUnit, setMeasureUnit] = useState("%");
  const [measureSource, setMeasureSource] = useState("manual");
  const [weeklyDrafts, setWeeklyDrafts] = useState<Record<string, string>>({});
  const [boostTarget, setBoostTarget] = useState("");
  const [boostAmount, setBoostAmount] = useState(10);
  const [boostReason, setBoostReason] = useState("");
  const [prizeName, setPrizeName] = useState("");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [prizeCost, setPrizeCost] = useState(50);
  const [prizeStock, setPrizeStock] = useState(1);
  const [redeemWallet, setRedeemWallet] = useState("");

  const activeGoals = useMemo(
    () => goals.filter((goal) => !["archived", "deleted"].includes(String(goal.status))),
    [goals],
  );
  const gemRecords = records.filter((record) =>
    ["gem_boost", "gem_redemption"].includes(String(record.recordType)),
  );
  const prizes = records.filter(
    (record) => record.recordType === "gem_prize" && record.status !== "archived",
  );
  const checkIns = records.filter((record) => record.recordType === "strategy_checkin");
  const epics = tasks.filter((task) => workType(task) === "epic");
  const measurableItems = tasks.filter((task) => ["epic", "pbi"].includes(workType(task)));
  const walletTargets = [
    ...projects.map((project) => ({
      key: `project:${project.id}`,
      id: project.id,
      type: "project",
      label: itemTitle(project),
      project,
    })),
    ...epics.map((epic) => ({
      key: `epic:${epic.id}`,
      id: epic.id,
      type: "epic",
      label: itemTitle(epic),
      project: projects.find((project) => project.id === epic.projectId),
    })),
  ];
  const currentMember = workspaceMembers.find(
    (member) =>
      member.userId === user?.uid ||
      String(member.email || "").toLowerCase() === String(user?.email || "").toLowerCase(),
  );
  const canManageRewards = ["owner", "admin"].includes(
    String(currentMember?.role || "").toLowerCase(),
  );
  const awardableTargets = walletTargets.filter((target) =>
    canAwardBoost(currentMember, target.project, user),
  );
  const redeemableTargets = walletTargets.filter(
    (target) =>
      gemBalance(gemRecords, target.id) > 0 &&
      (canManageRewards || canAwardBoost(currentMember, target.project, user)),
  );
  const totalGems = walletTargets.reduce(
    (sum, target) => sum + Math.max(0, gemBalance(gemRecords, target.id)),
    0,
  );
  const objectiveScores = activeGoals.map((goal) =>
    objectiveProgress(goal.id, keyResults, projects, tasks),
  );
  const averageScore = objectiveScores.length
    ? Math.round(objectiveScores.reduce((sum, score) => sum + score, 0) / objectiveScores.length)
    : 0;
  const onTrackCount = activeGoals.filter((goal) => {
    const progress = objectiveProgress(goal.id, keyResults, projects, tasks);
    return ["on_track", "done"].includes(objectiveHealth(goal, progress));
  }).length;

  const createObjective = async () => {
    if (!user || !workspace || !objectiveTitle.trim()) return;
    await addDoc(collection(db, "strategic_goals"), {
      userId: user.uid,
      workspaceId: workspace.id,
      title: objectiveTitle.trim(),
      description: objectiveDescription.trim(),
      type: "strategic_objective",
      objectiveType,
      cycle: objectiveCycle.trim() || strategyCycleLabel(),
      ownerId: objectiveOwnerId || null,
      status: "active",
      periodStart: new Date().toISOString().slice(0, 10),
      periodEnd: objectiveEnd,
      weeklyCommitment: "",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setObjectiveTitle("");
    setObjectiveDescription("");
    setShowObjectiveForm(false);
    setNotice("Objective created. Add two to five outcome measures next.");
  };

  const createMeasure = async () => {
    if (!user || !workspace || !measureGoalId) return;
    const [sourceType, sourceId] = measureSource.split(":");
    const source =
      sourceType === "project"
        ? projects.find((project) => project.id === sourceId)
        : sourceType === "work_item"
          ? tasks.find((task) => task.id === sourceId)
          : null;
    const title = measureTitle.trim() || (source ? itemTitle(source) : "");
    if (!title) return;
    const linked = Boolean(source);
    await addDoc(collection(db, "key_results"), {
      userId: user.uid,
      workspaceId: workspace.id,
      strategicGoalId: measureGoalId,
      title,
      measureKind,
      metricType: linked ? "percent" : "number",
      startValue: linked ? 0 : Number(measureStart),
      currentValue: linked ? 0 : Number(measureCurrent),
      targetValue: linked ? 100 : Number(measureTarget),
      unit: linked ? "%" : measureUnit.trim(),
      cadence: measureKind === "lead" ? "weekly" : "monthly",
      sourceType: linked ? sourceType : "manual",
      sourceId: linked ? sourceId : null,
      status: "active",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setMeasureGoalId(null);
    setMeasureTitle("");
    setMeasureSource("manual");
    setMeasureStart(0);
    setMeasureCurrent(0);
    setMeasureTarget(100);
    setNotice(measureKind === "lead" ? "Lead measure linked." : "Outcome measure added.");
  };

  const updateMeasure = async (measure: any, currentValue: number) => {
    await updateDoc(doc(db, "key_results", measure.id), {
      currentValue,
      status: currentValue >= Number(measure.targetValue || 0) ? "achieved" : "active",
      updatedAt: serverTimestamp(),
    });
  };

  const saveWeeklyPulse = async (goal: any) => {
    if (!user || !workspace) return;
    const commitment = String(weeklyDrafts[goal.id] ?? goal.weeklyCommitment ?? "").trim();
    if (!commitment) return;
    await updateDoc(doc(db, "strategic_goals", goal.id), {
      weeklyCommitment: commitment,
      lastCheckInAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await addDoc(collection(db, "strategic_initiatives"), {
      userId: user.uid,
      workspaceId: workspace.id,
      recordType: "strategy_checkin",
      strategicGoalId: goal.id,
      commitment,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    setNotice("Weekly commitment recorded in the strategy pulse.");
  };

  const giveBoost = async () => {
    if (!user || !workspace || !boostTarget || !boostReason.trim()) return;
    const target = awardableTargets.find((item) => item.key === boostTarget);
    if (!target) {
      setNotice("Only a workspace leader, Project Manager or Sponsor can give this Boost.");
      return;
    }
    await addDoc(collection(db, "strategic_initiatives"), {
      userId: user.uid,
      workspaceId: workspace.id,
      recordType: "gem_boost",
      walletType: target.type,
      walletEntityId: target.id,
      walletLabel: target.label,
      amount: Number(boostAmount),
      reason: boostReason.trim(),
      giverId: user.uid,
      giverName: memberLabel(currentMember),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    setBoostReason("");
    setNotice(`${boostAmount} Gems added to ${target.label}.`);
  };

  const createPrize = async () => {
    if (!user || !workspace || !canManageRewards || !prizeName.trim()) return;
    await addDoc(collection(db, "strategic_initiatives"), {
      userId: user.uid,
      workspaceId: workspace.id,
      recordType: "gem_prize",
      title: prizeName.trim(),
      description: prizeDescription.trim(),
      gemCost: Math.max(1, Number(prizeCost)),
      stock: Math.max(0, Number(prizeStock)),
      status: "active",
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setPrizeName("");
    setPrizeDescription("");
    setPrizeCost(50);
    setPrizeStock(1);
    setNotice("Prize added to the marketplace.");
  };

  const redeemPrize = async (prize: any) => {
    if (!user || !workspace || !redeemWallet) {
      setNotice("Choose the Project or Epic wallet that will redeem the prize.");
      return;
    }
    const target = redeemableTargets.find((item) => item.key === redeemWallet);
    const balance = target ? gemBalance(gemRecords, target.id) : 0;
    const cost = Number(prize.gemCost || 0);
    if (!target || balance < cost || Number(prize.stock || 0) < 1) {
      setNotice("That wallet does not have enough Gems, or the prize is out of stock.");
      return;
    }
    const batch = writeBatch(db);
    const redemptionRef = doc(collection(db, "strategic_initiatives"));
    batch.set(redemptionRef, {
      userId: user.uid,
      workspaceId: workspace.id,
      recordType: "gem_redemption",
      walletType: target.type,
      walletEntityId: target.id,
      walletLabel: target.label,
      prizeId: prize.id,
      prizeTitle: prize.title,
      amount: -cost,
      status: "requested",
      requestedBy: user.uid,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, "strategic_initiatives", prize.id), {
      stock: Math.max(0, Number(prize.stock || 0) - 1),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    setNotice(`${prize.title} redeemed for ${target.label}.`);
  };

  const openMeasureForm = (goalId: string, kind: MeasureKind) => {
    setMeasureGoalId(goalId);
    setMeasureKind(kind);
    setMeasureSource("manual");
    setMeasureTitle("");
  };

  return (
    <section className="do-strategy" aria-label="Strategic planning">
      <header className="do-strategy-head">
        <div>
          <span>STRATEGIC EXECUTION</span>
          <h1>Strategy</h1>
          <p>Choose the outcomes, track what predicts them, and commit weekly.</p>
        </div>
        <div>
          <button
            className="is-secondary"
            onClick={() =>
              onAsk(
                "Review our Strategy scoreboard. Tell me what is off track, which lead measure needs attention, and the most important commitment for this week.",
              )
            }
            type="button"
          >
            <Sparkles size={14} /> Ask Certo
          </button>
          <button onClick={() => setShowObjectiveForm(true)} type="button">
            <Plus size={14} /> New objective
          </button>
        </div>
      </header>

      {notice && (
        <div className="do-strategy-notice" role="status">
          <CheckCircle2 size={14} /> <span>{notice}</span>
          <button aria-label="Dismiss" onClick={() => setNotice("")} type="button">
            <X size={13} />
          </button>
        </div>
      )}

      <div className="do-strategy-metrics">
        <div><span>Active objectives</span><strong>{activeGoals.length}</strong><small>Keep the list intentionally short</small></div>
        <div><span>On track</span><strong>{onTrackCount}</strong><small>{activeGoals.length - onTrackCount} need attention</small></div>
        <div><span>Average score</span><strong>{averageScore}%</strong><small>Outcome measures only</small></div>
        <div className="is-gems"><span>Gems in play</span><strong><Gem size={16} /> {totalGems}</strong><small>Across Projects and Epics</small></div>
      </div>

      <nav className="do-strategy-tabs" aria-label="Strategy views">
        <button className={tab === "scoreboard" ? "is-active" : ""} onClick={() => setTab("scoreboard")} type="button"><Trophy size={14} /> Scoreboard</button>
        <button className={tab === "plan" ? "is-active" : ""} onClick={() => setTab("plan")} type="button"><Target size={14} /> Plan</button>
        <button className={tab === "rewards" ? "is-active" : ""} onClick={() => setTab("rewards")} type="button"><Gift size={14} /> Gems & rewards</button>
      </nav>

      {showObjectiveForm && (
        <div className="do-strategy-builder">
          <div className="do-strategy-builder-head"><div><strong>Create an objective</strong><small>One memorable outcome for a defined cycle.</small></div><button onClick={() => setShowObjectiveForm(false)} type="button"><X size={14} /></button></div>
          <div className="do-strategy-form-grid">
            <label className="is-wide"><span className="do-field-label"><span>Objective</span><AiRewriteButton context={{ cycle: objectiveCycle, description: objectiveDescription }} fieldKind="objective_title" onRewrite={setObjectiveTitle} text={objectiveTitle} /></span><input autoFocus onChange={(event) => setObjectiveTitle(event.target.value)} placeholder="What must be meaningfully different?" value={objectiveTitle} /></label>
            <label><span>Cycle</span><input onChange={(event) => setObjectiveCycle(event.target.value)} value={objectiveCycle} /></label>
            <label><span>Type</span><select onChange={(event) => setObjectiveType(event.target.value)} value={objectiveType}><option value="committed">Committed</option><option value="aspirational">Aspirational</option><option value="learning">Learning</option></select></label>
            <label><span>Owner</span><select onChange={(event) => setObjectiveOwnerId(event.target.value)} value={objectiveOwnerId}><option value="">Unassigned</option>{workspaceMembers.map((member) => <option key={member.id} value={member.id}>{memberLabel(member)}</option>)}</select></label>
            <label><span>Target date</span><input onChange={(event) => setObjectiveEnd(event.target.value)} type="date" value={objectiveEnd} /></label>
            <label className="is-wide"><span className="do-field-label"><span>Why this matters</span><AiRewriteButton context={{ objective: objectiveTitle, cycle: objectiveCycle }} fieldKind="objective_description" onRewrite={setObjectiveDescription} text={objectiveDescription} /></span><textarea onChange={(event) => setObjectiveDescription(event.target.value)} placeholder="Strategic context and intended outcome" rows={2} value={objectiveDescription} /></label>
          </div>
          <div className="do-strategy-builder-actions"><button className="is-secondary" onClick={() => setShowObjectiveForm(false)} type="button">Cancel</button><button disabled={!objectiveTitle.trim()} onClick={createObjective} type="button">Create objective</button></div>
        </div>
      )}

      {tab === "scoreboard" && (
        <div className="do-scoreboard">
          {activeGoals.map((goal) => {
            const measures = keyResults.filter((measure) => measure.strategicGoalId === goal.id);
            const outcomes = measures.filter((measure) => String(measure.measureKind || "outcome") === "outcome");
            const leads = measures.filter((measure) => measure.measureKind === "lead");
            const progress = objectiveProgress(goal.id, keyResults, projects, tasks);
            const health = objectiveHealth(goal, progress);
            const owner = workspaceMembers.find((member) => member.id === goal.ownerId);
            const lastCheckIn = checkIns.filter((item) => item.strategicGoalId === goal.id).length;
            return (
              <article className="do-objective-card" key={goal.id}>
                <header>
                  <div className="do-objective-score" style={{ "--score": `${progress}%` } as any}><strong>{progress}</strong><small>%</small></div>
                  <div><span>{goal.cycle || strategyCycleLabel()} · {String(goal.objectiveType || "committed").replace(/_/g, " ")}</span><h2>{itemTitle(goal)}</h2><p>{goal.description || "Add the strategic reason this outcome matters."}</p></div>
                  <div className={`do-strategy-health is-${health}`}>{health === "on_track" || health === "done" ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}{statusLabel(health)}</div>
                </header>
                <div className="do-objective-meta"><span><Users size={13} /> {memberLabel(owner)}</span><span><CalendarDays size={13} /> {goal.periodEnd || "No target date"}</span><span>{lastCheckIn} weekly pulse{lastCheckIn === 1 ? "" : "s"}</span></div>
                <div className="do-objective-grid">
                  <section>
                    <div className="do-measure-title"><strong>Outcome measures</strong><small>Did the result move?</small></div>
                    {outcomes.map((measure) => <MeasureRow key={measure.id} measure={measure} projects={projects} tasks={tasks} onUpdate={updateMeasure} />)}
                    {!outcomes.length && <button className="do-empty-measure" onClick={() => { setTab("plan"); openMeasureForm(goal.id, "outcome"); }} type="button"><Plus size={13} /> Add a measurable result</button>}
                  </section>
                  <section>
                    <div className="do-measure-title"><strong>Lead measures</strong><small>Predictive and influenceable</small></div>
                    {leads.map((measure) => <MeasureRow key={measure.id} measure={measure} projects={projects} tasks={tasks} onUpdate={updateMeasure} />)}
                    {!leads.length && <button className="do-empty-measure" onClick={() => { setTab("plan"); openMeasureForm(goal.id, "lead"); }} type="button"><Link2 size={13} /> Link a Project, Epic or PBI</button>}
                  </section>
                </div>
                <div className="do-weekly-pulse"><div><strong>This week</strong><small>One commitment that can move the scoreboard.</small></div><input onChange={(event) => setWeeklyDrafts((current) => ({ ...current, [goal.id]: event.target.value }))} placeholder="What will we move before the next check-in?" value={weeklyDrafts[goal.id] ?? goal.weeklyCommitment ?? ""} /><button onClick={() => saveWeeklyPulse(goal)} type="button">Check in</button></div>
              </article>
            );
          })}
          {!activeGoals.length && <EmptyStrategy onCreate={() => setShowObjectiveForm(true)} />}
        </div>
      )}

      {tab === "plan" && (
        <div className="do-strategy-plan">
          <div className="do-strategy-guide"><strong>A strategy that can execute</strong><div><span>1</span><p><b>Objective</b>Memorable direction for one cycle.</p></div><div><span>2</span><p><b>Outcome measures</b>Two to five results with a start, target and deadline.</p></div><div><span>3</span><p><b>Lead measures</b>Weekly actions the team can influence—manual or linked work.</p></div><div><span>4</span><p><b>Weekly pulse</b>Review the score and make one next commitment.</p></div></div>
          <div className="do-strategy-plan-list">
            {activeGoals.map((goal) => {
              const measures = keyResults.filter((measure) => measure.strategicGoalId === goal.id);
              return <article key={goal.id}><header><div><span>{goal.cycle || strategyCycleLabel()}</span><h3>{itemTitle(goal)}</h3></div><strong>{objectiveProgress(goal.id, keyResults, projects, tasks)}%</strong></header><div className="do-plan-measures">{measures.map((measure) => <MeasureRow key={measure.id} measure={measure} projects={projects} tasks={tasks} onUpdate={updateMeasure} />)}</div><footer><button onClick={() => openMeasureForm(goal.id, "outcome")} type="button"><Plus size={12} /> Outcome measure</button><button onClick={() => openMeasureForm(goal.id, "lead")} type="button"><Link2 size={12} /> Lead measure</button></footer>{measureGoalId === goal.id && <MeasureBuilder kind={measureKind} title={measureTitle} setTitle={setMeasureTitle} source={measureSource} setSource={setMeasureSource} measurableItems={measurableItems} projects={projects} start={measureStart} setStart={setMeasureStart} current={measureCurrent} setCurrent={setMeasureCurrent} target={measureTarget} setTarget={setMeasureTarget} unit={measureUnit} setUnit={setMeasureUnit} onCancel={() => setMeasureGoalId(null)} onCreate={createMeasure} />}</article>;
            })}
            {!activeGoals.length && <EmptyStrategy onCreate={() => setShowObjectiveForm(true)} />}
          </div>
        </div>
      )}

      {tab === "rewards" && (
        <div className="do-rewards">
          <section className="do-wallets"><header><div><span>TEAM RECOGNITION</span><h2>Gem wallets</h2><p>Boost meaningful delivery. Gems belong to the Project or Epic—not to vanity activity.</p></div><Gem size={25} /></header><div>{walletTargets.filter((target) => gemBalance(gemRecords, target.id) > 0).map((target) => <button className={redeemWallet === target.key ? "is-active" : ""} key={target.key} onClick={() => setRedeemWallet(target.key)} type="button"><span>{target.type}</span><strong>{target.label}</strong><b><Gem size={13} /> {gemBalance(gemRecords, target.id)}</b></button>)}{!walletTargets.some((target) => gemBalance(gemRecords, target.id) > 0) && <p className="do-reward-empty">No Gems yet. A leader can give the first Boost below.</p>}</div></section>
          <div className="do-reward-grid">
            <section className="do-boost-card"><header><div><span>BOOST</span><h3>Recognize strategic progress</h3></div><Sparkles size={18} /></header>{awardableTargets.length ? <><label><span>Project or Epic</span><select onChange={(event) => setBoostTarget(event.target.value)} value={boostTarget}><option value="">Choose work</option>{awardableTargets.map((target) => <option key={target.key} value={target.key}>{target.type === "epic" ? "Epic" : "Project"} · {target.label}</option>)}</select></label><label><span>Gems</span><select onChange={(event) => setBoostAmount(Number(event.target.value))} value={boostAmount}><option value={5}>5 · Good move</option><option value={10}>10 · Strong delivery</option><option value={25}>25 · Breakthrough</option></select></label><label><span>Why it earned a Boost</span><textarea onChange={(event) => setBoostReason(event.target.value)} placeholder="Name the result or behavior worth repeating" rows={3} value={boostReason} /></label><button disabled={!boostTarget || !boostReason.trim()} onClick={giveBoost} type="button"><Gem size={13} /> Give Boost</button></> : <p className="do-reward-empty">Boosts can be given by workspace leaders or the Project Manager/Sponsor of the selected project.</p>}</section>
            <section className="do-marketplace"><header><div><span>MARKETPLACE</span><h3>Redeem team rewards</h3></div><Gift size={18} /></header><label><span>Pay from</span><select onChange={(event) => setRedeemWallet(event.target.value)} value={redeemWallet}><option value="">Choose a Gem wallet</option>{redeemableTargets.map((target) => <option key={target.key} value={target.key}>{target.label} · {gemBalance(gemRecords, target.id)} Gems</option>)}</select></label><div className="do-prize-list">{prizes.map((prize) => <article key={prize.id}><div><strong>{prize.title}</strong><small>{prize.description || "Team reward"}</small></div><span><Gem size={12} /> {prize.gemCost}</span><small>{prize.stock} available</small><button disabled={!redeemWallet || Number(prize.stock || 0) < 1} onClick={() => redeemPrize(prize)} type="button">Redeem</button></article>)}{!prizes.length && <p className="do-reward-empty">No prizes yet. Workspace leaders can create the first one.</p>}</div></section>
          </div>
          {canManageRewards && <section className="do-prize-builder"><header><div><span>CATALOG MANAGEMENT</span><h3>Create a prize</h3></div></header><div><label><span>Name</span><input onChange={(event) => setPrizeName(event.target.value)} placeholder="Team lunch" value={prizeName} /></label><label><span>Gem cost</span><input min={1} onChange={(event) => setPrizeCost(Number(event.target.value))} type="number" value={prizeCost} /></label><label><span>Stock</span><input min={0} onChange={(event) => setPrizeStock(Number(event.target.value))} type="number" value={prizeStock} /></label><label className="is-wide"><span>Description / fulfillment</span><input onChange={(event) => setPrizeDescription(event.target.value)} placeholder="What the winner receives and how it is fulfilled" value={prizeDescription} /></label><button disabled={!prizeName.trim()} onClick={createPrize} type="button"><Plus size={13} /> Add prize</button></div></section>}
          <section className="do-gem-ledger"><header><div><span>AUDIT TRAIL</span><h3>Recent Gem activity</h3></div></header>{gemRecords.slice().sort((left, right) => Number(right.createdAt?.seconds || 0) - Number(left.createdAt?.seconds || 0)).slice(0, 12).map((record) => <div key={record.id}><span className={Number(record.amount) < 0 ? "is-spend" : "is-earn"}>{Number(record.amount) > 0 ? "+" : ""}{record.amount}</span><p><strong>{record.walletLabel}</strong><small>{record.recordType === "gem_redemption" ? `Redeemed ${record.prizeTitle}` : record.reason}</small></p><time>{record.giverName || "Workspace"}</time></div>)}{!gemRecords.length && <p className="do-reward-empty">Boosts and redemptions will appear here. Balances are calculated from this ledger.</p>}</section>
        </div>
      )}
    </section>
  );
}

function MeasureRow({ measure, projects, tasks, onUpdate }: { measure: any; projects: any[]; tasks: any[]; onUpdate: (measure: any, value: number) => void }) {
  const progress = linkedWorkProgress(measure, projects, tasks);
  const linked = measure.sourceType === "project" || measure.sourceType === "work_item";
  const source = measure.sourceType === "project" ? projects.find((item) => item.id === measure.sourceId) : tasks.find((item) => item.id === measure.sourceId);
  return <div className="do-measure-row"><div><span>{measure.measureKind === "lead" ? "LEAD" : "OUTCOME"}{linked ? ` · ${measure.sourceType === "project" ? "PROJECT" : workType(source).toUpperCase()}` : ""}</span><strong>{measure.title}</strong>{linked && <small><Link2 size={10} /> {itemTitle(source)}</small>}</div><div className="do-measure-value">{linked ? <strong>{progress}%</strong> : <><input aria-label={`Current value for ${measure.title}`} defaultValue={measure.currentValue ?? measure.startValue ?? 0} onBlur={(event) => onUpdate(measure, Number(event.target.value || 0))} type="number" /><span>/ {measure.targetValue}{measure.unit || ""}</span></>}</div><i><b style={{ width: `${progress}%` }} /></i></div>;
}

function MeasureBuilder({ kind, title, setTitle, source, setSource, measurableItems, projects, start, setStart, current, setCurrent, target, setTarget, unit, setUnit, onCancel, onCreate }: any) {
  const linked = source !== "manual";
  return <div className="do-measure-builder"><header><div><strong>{kind === "lead" ? "Add a lead measure" : "Add an outcome measure"}</strong><small>{kind === "lead" ? "Predictive, influenceable, and reviewed weekly." : "A measurable result, not a task."}</small></div><button onClick={onCancel} type="button"><X size={13} /></button></header>{kind === "lead" && <label><span>Source</span><select onChange={(event) => setSource(event.target.value)} value={source}><option value="manual">Manual measure</option><optgroup label="Projects">{projects.map((project: any) => <option key={project.id} value={`project:${project.id}`}>{itemTitle(project)}</option>)}</optgroup><optgroup label="Epics and PBIs">{measurableItems.map((item: any) => <option key={item.id} value={`work_item:${item.id}`}>{workType(item).toUpperCase()} · {itemTitle(item)}</option>)}</optgroup></select></label>}<label className="is-wide"><span className="do-field-label"><span>Name</span>{!linked && <AiRewriteButton context={{ measureKind: kind, start, target, unit }} fieldKind="measure_title" onRewrite={setTitle} text={title} />}</span><input disabled={linked} onChange={(event) => setTitle(event.target.value)} placeholder={linked ? "Uses the linked work title" : kind === "lead" ? "Weekly demos completed" : "Increase adoption from 35% to 60%"} value={title} /></label>{!linked && <div className="do-measure-numbers"><label><span>Start</span><input onChange={(event) => setStart(Number(event.target.value))} type="number" value={start} /></label><label><span>Current</span><input onChange={(event) => setCurrent(Number(event.target.value))} type="number" value={current} /></label><label><span>Target</span><input onChange={(event) => setTarget(Number(event.target.value))} type="number" value={target} /></label><label><span>Unit</span><input onChange={(event) => setUnit(event.target.value)} value={unit} /></label></div>}<footer><button className="is-secondary" onClick={onCancel} type="button">Cancel</button><button disabled={!linked && !title.trim()} onClick={onCreate} type="button">Add measure</button></footer></div>;
}

function EmptyStrategy({ onCreate }: { onCreate: () => void }) {
  return <div className="do-strategy-empty"><Target size={24} /><strong>No strategic objectives yet</strong><p>Start with one outcome that deserves exceptional focus this cycle.</p><button onClick={onCreate} type="button"><Plus size={13} /> Create objective</button><ArrowRight size={14} /></div>;
}

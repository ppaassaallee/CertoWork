import { useEffect, useMemo, useState } from "react";
import { useRunItems } from "../../data/collections";
import { canUseCertoRun } from "../../run/access";
import {
  availableFte,
  checkAllocation,
  DEFAULT_CAP_MONTH,
  fteOf,
  hoursWeek,
  loadOf,
  monthHours,
  overAllocated,
  utilClass,
  type AllocRow,
} from "../../lib/certoRun/allocation";
import { agedAdminCount } from "../../lib/certoRun/caps";
import { addDays, mondayOf, workingDaysOfMonth } from "../../lib/certoRun/dates";
import {
  DEFAULT_TEMPLATE,
  currentBlock,
  dayPlan,
  morningWorld,
  muteLabel,
  nowChip,
  vis,
  type DayBlock,
} from "../../lib/certoRun/dayplan";
import { checkTitle, GATE_QUESTIONS, gateDest, type GateKey } from "../../lib/certoRun/intake";
import { DEFAULT_MANIFESTO } from "../../lib/certoRun/manifesto";
import {
  adminOpen,
  decQ,
  delQ,
  openCount,
  p1Alive,
  queueCounts,
  segQ,
  soloQ,
} from "../../lib/certoRun/queues";
import { runDocToDeskItem } from "../../lib/certoRun/store";
import type { DeskItem } from "../../lib/certoRun/types";
import { MOOD_KEYS, RUN_WORLDS, STAGES, type Decision, type Health, type Lane, type RunWorld } from "../../lib/certoRun/vocab";
import {
  clearRunTop3,
  completeRunItem,
  createRunItem,
  delegateRunItem,
  moveRunItemToMake,
  renegotiateRunItem,
  setRunHealth,
  setRunTop3,
  setRunUnblock,
  patchRunItem,
} from "../../lib/certoRun/writes";
import { RunValidationDialog } from "./RunValidationDialog";
import { RunAgentPanel, useRunAgentSnapshot, type AgentSnapshot } from "./RunAgentPanel";
import { useLocale } from "../../lib/useLocale";
import { runText as t, runDate as formatDate, runDay as dayName, runMonth, runError } from "./runCopy";
import { RunDialog, RunTabs } from "./RunDialog";
import { RunQueue, RunItemDrawer, type QueueMode, type RunItemActions } from "./RunQueue";
import { RunCommand } from "./RunCommand";
import "./certo-run.css";
import "./run-interactions.css";
import "../../run/styles/tokens.css";

export type RunTab = "today" | "queue" | "projects" | "team" | "week" | "intake" | "close" | "life";
type ProjectView = "pipeline" | "delivery" | "portfolio";
type TeamView = "allocation" | "utilization" | "lead";

interface Props {
  workspaceId: string;
  user: { uid: string; displayName?: string | null; email?: string | null; emailVerified?: boolean };
  tab: RunTab;
  onTab: (tab: RunTab) => void;
  onBack: () => void;
}

const ZONE = "America/Guatemala";
const WORLD_KEY = "certo-run-world";
const ALLOC_KEY = "certo-run-alloc";
const TABS: RunTab[] = ["today", "queue", "projects", "team", "week", "intake", "close"];
const TAB_LABEL: Record<RunTab, string> = {
  today: "Today",
  queue: "Queue",
  projects: "Projects",
  team: "Team",
  week: "Week",
  intake: "Intake",
  close: "Close",
  life: "Life",
};

const PRINCIPLES = [
  ["Talent density", "First priority before growth. High talent density raises performance everywhere."],
  ["Candor & 4A feedback", "Aim to assist, actionable, appreciate, accept or decline. In private for criticism."],
  ["Fewer controls", "Lead with context, not control. If they make a mistake, ask what context was missing."],
  ["Informed captain", "A captain decides and informs me. A delegate does not need consensus."],
  ["Highly aligned, loosely coupled", "Clear strategy, zero micromanagement on execution paths."],
  ["Keeper test", "If they wanted to leave tomorrow, would I fight hard to keep them?"],
];

function zoneToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function zoneMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return (hour === 24 ? 0 : hour) * 60 + minute;
}

function civil(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || !value.includes("T")) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function savedWorld(): RunWorld {
  try {
    const saved = window.localStorage.getItem(WORLD_KEY);
    if (saved === "Pure AI" || saved === "Boldr AI" || saved === "Personal") return saved;
  } catch {
    /* private mode */
  }
  return "Pure AI";
}

function initials(name?: string | null): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  const letters = ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
  return letters || "CR";
}

function matches(item: DeskItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${item.title} ${item.epic} ${item.clientEntity || ""} ${item.deliverable || ""}`.toLowerCase().includes(needle);
}

function railCopy(block: DayBlock, visible: boolean, world: string): { name: string; sub: string } {
  if (!visible) {
    if (block.kind === "family") return { name: "Personal time", sub: "FAMILY AND LUNCH" };
    if (block.kind === "evening") return { name: "Personal time", sub: "FAMILY AND EVENING" };
    return { name: t(muteLabel(block, world)), sub: block.world && block.world !== "work" ? t("Use for {world}", { world: block.world }) : t("Outside this world") };
  }
  if (block.kind === "brief") return { name: "Brief and decisions", sub: "Read the brief, answer yes or no" };
  if (block.kind === "make") return { name: "Make: only me", sub: "No meetings" };
  if (block.kind === "meetings") return { name: "Meetings and fronts", sub: "Internal agenda, clients, follow-ups" };
  if (block.kind === "family") return { name: "Personal time", sub: "FAMILY AND LUNCH" };
  if (block.kind === "afternoon") return { name: "Fronts afternoon", sub: "Clients, team, unblocking" };
  if (block.kind === "close") return { name: "Close the day", sub: "Promised dates and hand-off" };
  if (block.kind === "evening") return { name: "Personal time", sub: "FAMILY AND EVENING" };
  if (block.kind === "weekly") return { name: "Weekly review", sub: "No clients" };
  if (block.kind === "admin") return { name: "Admin batch", sub: "Approve, delegate or drop" };
  return { name: block.name, sub: block.sub };
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    /* clipboard can be denied */
  }
}

export function CertoRunDesk({ workspaceId, user, tab, onTab, onBack }: Props) {
  if (!canUseCertoRun(user)) return <section role="alert">{t("This module is not available for this account.")}</section>;
  return <AuthorizedRunDesk workspaceId={workspaceId} user={user} tab={tab} onTab={onTab} onBack={onBack} />;
}

function AuthorizedRunDesk({ workspaceId, user, tab, onTab, onBack }: Props) {
  const locale=useLocale();
  const loadingCopy=locale==="es"?{loading:"Cargando tu espacio delegado…",retry:"Reintentar"}:{loading:"Loading your delegated workspace…",retry:"Retry"};
  const personalRows = useRunItems(workspaceId);
  const [world,setWorld]=useState<RunWorld>(savedWorld);
  const {snapshot,error,refresh}=useRunAgentSnapshot(world);
  if(world!=="Personal"&&!snapshot)return <section className="cr-desk cr-agent-loading" aria-live="polite"><h2>{world}</h2><p>{error?runError(error):loadingCopy.loading}</p><button className="cr-tool" type="button" onClick={refresh}>{loadingCopy.retry}</button><button className="cr-tool" type="button" onClick={onBack}>{t("Certo Work")}</button></section>;
  return <RunDeskView workspaceId={world==="Personal"?workspaceId:snapshot!.workspace_id} user={user} tab={tab} onTab={onTab} onBack={onBack} rows={world==="Personal"?personalRows:snapshot!.items} controlledWorld={world} onWorldChange={setWorld} agentSnapshot={world==="Personal"?undefined:snapshot!} onDataChanged={refresh} agentError={error} />;
}

/** The real view, separated from its live subscription for non-mutating visual tests. */
export function RunDeskView({ workspaceId, user, tab, onTab, onBack, rows, controlledWorld, onWorldChange, agentSnapshot, onDataChanged, agentError }: Props & { rows: Array<Record<string, unknown> & { id: string }>; controlledWorld?:RunWorld; onWorldChange?:(world:RunWorld)=>void; agentSnapshot?:AgentSnapshot; onDataChanged?:()=>void; agentError?:string }) {
  const locale = useLocale();
  const [mode, setMode] = useState<QueueMode>("make");
  const [projectView, setProjectView] = useState<ProjectView>("pipeline");
  const [teamView, setTeamView] = useState<TeamView>("allocation");
  const [form, setForm] = useState<{ id: string; kind: "delegate" | "date" | "drop" } | null>(null);
  const [refusal, setRefusal] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(zoneMinutes);
  const [manifestoOpen, setManifestoOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [focusUntil, setFocusUntil] = useState<number | null>(null);
  const [gate, setGate] = useState<Partial<Record<GateKey, boolean>>>({});
  const [draftTitle, setDraftTitle] = useState("");
  const [draftLane, setDraftLane] = useState<Lane>("commercial");
  const [draftDecision, setDraftDecision] = useState<Decision>("make");
  const [draftClient, setDraftClient] = useState("");
  const [draftDeliverable, setDraftDeliverable] = useState("");
  const [draftDone, setDraftDone] = useState("");
  const [draftNext, setDraftNext] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localWorld, setWorld] = useState<RunWorld>(savedWorld);
  const world=controlledWorld??localWorld;
  const items = useMemo(
    () =>
      rows
        .map((row) => runDocToDeskItem(row.id, row, { id: workspaceId }))
        .filter((item): item is DeskItem => item !== null),
    [rows, workspaceId],
  );
  const today = zoneToday();

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  async function perform(action: () => Promise<unknown>) {
    if (saving) return;
    if (!navigator.onLine) { setError("Offline: reconnect before changing commitments."); return; }
    setError("");
    setSaving(true);
    try { await action(); onDataChanged?.(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save. Please try again."); }
    finally { setSaving(false); }
  }

  useEffect(() => {
    const timer = window.setInterval(() => setMinutes(zoneMinutes()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.defaultPrevented && !(event.target as HTMLElement)?.closest("dialog") && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const worldItems = items.filter((item) => item.world === world);
  const visibleItems = worldItems.filter((item) => matches(item, query));
  const options = { workspace: world };
  const pendingProposals=agentSnapshot?.control.proposals.filter(proposal=>proposal.status==="pending").length||0;
  const baseCounts=queueCounts(worldItems, options);
  const counts = {...baseCounts,decide:baseCounts.decide+pendingProposals};
  const plan = useMemo(() => dayPlan(today, DEFAULT_TEMPLATE), [today]);
  const chip = nowChip(plan, world, minutes);
  const current = currentBlock(plan, minutes);
  const gap = current.kind === "before" || current.kind === "after";
  const nowVisible = !gap && vis(current, world);
  const queue = queueFor(visibleItems, world, mode);
  const top3 = worldItems.filter((item) => item.runTop3Date === today).map((item) => item.id);
  const makeItems = soloQ(worldItems, options);
  const decisions = decQ(visibleItems, options);
  const p1 = p1Alive(worldItems, options).length;
  const admin = adminOpen(worldItems, options).length;
  const resolvedToday = worldItems.filter((item) => item.state === "done" && civil(item.outcome?.at) === today).length;
  const weekStart = mondayOf(today);
  const resolvedWeek = worldItems.filter((item) => {
    const doneOn = civil(item.outcome?.at);
    return item.state === "done" && doneOn >= weekStart && doneOn <= addDays(weekStart, 6);
  }).length;
  const cameIn = worldItems.filter((item) => item.created === today).length;

  function chooseWorld(next: RunWorld) {
    setSelectedId(null);
    setSearchOpen(false);
    setForm(null);
    setRefusal([]);
    setQuery("");
    setError("");
    setGate({});
    setDraftTitle("");
    setDraftClient("");
    setDraftDeliverable("");
    setDraftDone("");
    setDraftNext("");
    setDraftLane(next === "Personal" ? "personal" : "commercial");
    setWorld(next);
    onWorldChange?.(next);
    try { window.localStorage.setItem(WORLD_KEY, next); } catch { /* private mode */ }
    onTab("today");
  }

  async function onMake(id: string) {
    setError("");
    const result = await moveRunItemToMake(worldItems, world, id);
    if (!result.ok) setRefusal(result.current.map((row) => row.title));
    else setRefusal([]);
  }

  const selectedItem = worldItems.find(item => item.id === selectedId && item.state === "open");
  const itemActions: RunItemActions = {
    busy: saving,
    onDone: id => void perform(() => completeRunItem(id, worldItems.find(item => item.id === id)?.decision === "decide" ? "yes" : "done")),
    onNo: id => void perform(() => completeRunItem(id, "no")),
    onMake: id => void perform(() => onMake(id)),
    onDrop: id => { setSelectedId(id); setForm({ id, kind: "drop" }); },
    onForm: next => { if (next) setSelectedId(next.id); setForm(next); },
    onPostpone: id => void perform(() => patchRunItem(id, { runOutcome: { kind: "postponed", ts: Date.now(), at: new Date().toISOString() } })),
  };

  return (
    <section className="cr-desk" data-testid="certo-run-desk" data-world={world} lang={locale}>
      <div className="cr-bar">
        <div className="cr-bar-row">
          <div className="cr-worlds" aria-label={t("Worlds")} data-testid="certo-run-worlds">
            {RUN_WORLDS.map((name) => (
              <button
                aria-pressed={name === world}
                className="cr-world"
                data-testid={`run-world-${name}`}
                data-world={name}
                key={name}
                onClick={() => chooseWorld(name)}
                type="button"
              >
                {name !== world && <span className="cr-dot" />}
                {name} ({controlledWorld&&name!==world?"—":openCount(items, name)})
              </button>
            ))}
          </div>
          <div className="cr-center">
            <span className="cr-date">{formatDate(today)}</span>
            {chip.label && (
              <span className="cr-now" data-testid="certo-run-now">
                {nowVisible ? t(chip.label) : t("Next · {label}", { label: t(chip.label) })} ({chip.time})
              </span>
            )}
          </div>
          <div className="cr-tools">
            <button aria-label={t("Search")} aria-keyshortcuts="Meta+K Control+K" className="cr-tool cr-command-trigger" onClick={() => setSearchOpen(true)} type="button">{t("Search")} <kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"}</kbd></button>
            <button className="cr-tool" onClick={() => setManifestoOpen(true)} type="button">{t("Manifesto")}</button>
            <button className="cr-tool" onClick={() => setValidationOpen(true)} type="button">{t("Data & validation")}</button>
            <button className="cr-avatar" onClick={onBack} title={t("Certo Work")} type="button">{initials(user.displayName)}</button>
          </div>
        </div>
        <RunTabs className="cr-tabs" label={t("Run navigation")} value={tab} onChange={onTab} panelId="cr-main-panel"
          options={(world === "Personal" ? ["today", "life", "intake", "close"] as RunTab[] : TABS).map(name => ({ value: name, label: t(TAB_LABEL[name]) }))} />
      </div>
      <div className="cr-body" id="cr-main-panel" role="tabpanel" aria-labelledby={`cr-main-panel-tab-${tab}`}>
        {query && <div className="cr-filter-summary"><span>{t("Filtered by {query}", { query })}</span><button type="button" className="cr-link" onClick={() => setQuery("")}>{t("Clear filter")}</button></div>}
        {agentError&&<p className="cr-flag" role="alert">{runError(agentError)}</p>}
        {agentSnapshot&&<RunAgentPanel snapshot={agentSnapshot} tab={tab} decide={mode==="decide"} onRefresh={()=>onDataChanged?.()} onOpenDecide={()=>{setMode("decide");onTab("queue");}} />}
        {worldItems.length === 0 && tab === "today" && <section className="cr-empty-state"><p>{world} {t("is empty. Add work through Intake or validate an ingestion file to get started.")}</p><button className="cr-solid" onClick={() => setValidationOpen(true)} type="button">{t("Open Data & validation")}</button></section>}
        {!online && <p className="cr-flag" role="status">{t("Offline: reconnect before changing commitments.")}</p>}
        {saving && <p role="status" className="cr-muted">{t("Saving…")}</p>}
        {refusal.length > 0 && (
          <div className="cr-flag" data-testid="certo-run-cap" role="status">
            {t("At the cap. The current list stays.")} {refusal.join(" · ")}
          </div>
        )}
        {error && <p className="cr-flag" role="alert">{runError(error)}</p>}
        {tab === "today" && (
          <Today
            activeWorld={world}
            admin={admin}
            aged={agedAdminCount(worldItems, options, today)}
            cameIn={cameIn}
            counts={counts}
            current={current}
            decisions={decisions}
            make={makeItems.filter((item) => matches(item, query))}
            onDeck={() => { setMode("decide"); onTab("queue"); }}
            onNo={(id) => void perform(() => completeRunItem(id, "no"))}
            onQueue={() => onTab("queue")}
            onIntake={() => onTab("intake")}
            owed={segQ(worldItems, options)}
            onYes={(id) => void perform(() => completeRunItem(id, "yes"))}
            p1={p1}
            plan={plan}
            resolvedToday={resolvedToday}
            resolvedWeek={resolvedWeek}
          />
        )}
        {tab === "queue" && (
          <RunQueue
            counts={{
              make: soloQ(worldItems, options).length,
              decide: decQ(worldItems, options).length+pendingProposals,
              owed: segQ(worldItems, options).length,
              admin,
              delegated: delQ(worldItems, options).length,
              unsorted: worldItems.filter((item) => item.state === "open" && item.inQueue === false).length,
            }}
            items={queue}
            key={`${workspaceId}:${world}`}
            mode={mode}
            actions={itemActions}
            onOpen={setSelectedId}
            onIntake={() => onTab("intake")}
            onMode={setMode}
          />
        )}
        {tab === "projects" && (
          <Projects
            items={visibleItems.filter((item) => item.state === "open")}
            view={projectView}
            onView={setProjectView}
            world={world}
          />
        )}
        {tab === "team" && <Team key={`${workspaceId}:${user.uid}:${world}`} storageScope={`${workspaceId}:${user.uid}`} view={teamView} world={world} onView={setTeamView} />}
        {tab === "week" && <Week items={makeItems} today={today} world={world} />}
        {tab === "life" && <p className="cr-panel">{t("Personal stays in its own world. Nothing from Work is copied here.")}</p>}
        {tab === "intake" && (
          <Intake
            client={draftClient}
            decision={draftDecision}
            deliverable={draftDeliverable}
            doneWhen={draftDone}
            gate={gate}
            lane={draftLane}
            nextStep={draftNext}
            onClient={setDraftClient}
            onDecision={setDraftDecision}
            onDeliverable={setDraftDeliverable}
            onDone={setDraftDone}
            onGate={setGate}
            onLane={setDraftLane}
            onNext={setDraftNext}
            onTitle={setDraftTitle}
            title={draftTitle}
            onSave={() => void perform(async () => {
              const created = await createRunItem({
                userId: user.uid,
                workspaceId,
                currentItems: worldItems,
                world,
                title: draftTitle,
                decision: draftDecision,
                lane: draftLane,
                details: draftTitle,
                deliverable: draftDeliverable,
                doneWhen: draftDone,
                nextStep: draftNext,
                client: draftClient,
                epic: draftClient,
              });
              if (!created.ok) setError(created.reason);
              else {
                setDraftTitle("");
                setDraftDeliverable("");
                setDraftDone("");
                setDraftNext("");
                setGate({});
                onTab("queue");
              }
            })}
          />
        )}
        {tab === "close" && (
          <Close
            cameIn={cameIn}
            make={makeItems}
            onAdd={(title, date) => void perform(async () => {
              const decision: Decision = makeItems.length >= 5 ? "decide" : "make";
              const result = await createRunItem({
                userId: user.uid,
                workspaceId,
                currentItems: worldItems,
                world,
                title,
                decision,
                lane: world === "Personal" ? "personal" : "commercial",
                dueDate: date,
              });
              if (!result.ok) throw new Error(result.reason);
            })}
            onDone={(id) => void perform(() => completeRunItem(id, "done"))}
            onToggle={(id) => void perform(async () => {
              if (top3.includes(id)) {
                await clearRunTop3(id);
                return;
              }
              const result = await setRunTop3(top3, id, today);
              if (!result.ok) setRefusal(result.current.map((row) => row.title));
            })}
            promised={worldItems.filter((item) => item.state === "open" && item.dueDate)}
            resolved={resolvedToday}
            today={today}
            top3={top3}
            world={world}
          />
        )}
      </div>
      {searchOpen && <RunCommand items={worldItems} tabs={world === "Personal" ? ["today", "life", "intake", "close"] : TABS}
        onTab={onTab} onItem={id => { setForm(null); setSelectedId(id); }} onFilter={setQuery} onClose={() => setSearchOpen(false)} />}
      {selectedItem && <RunItemDrawer key={selectedItem.id} item={selectedItem} actions={itemActions} form={form} error={error ? runError(error) : ""} onClose={() => { setSelectedId(null); setForm(null); }}
        onSave={value => void perform(async () => {
          if (!form) return;
          if (form.kind === "delegate") await delegateRunItem(form.id, value.who, value.date, "captain", value.context);
          if (form.kind === "date") await renegotiateRunItem(form.id, value.date);
          if (form.kind === "drop") await completeRunItem(form.id, "dropped", value.context || "Adds nothing");
          setForm(null);
        })} />}
      {manifestoOpen && (
        <Manifesto
          until={focusUntil}
          onClose={() => { setManifestoOpen(false); setFocusUntil(null); }}
          onStart={() => setFocusUntil(Date.now() + 25 * 60_000)}
        />
      )}
      {validationOpen && <RunValidationDialog onClose={() => setValidationOpen(false)} />}
    </section>
  );
}

function queueFor(items: DeskItem[], world: string, mode: QueueMode): DeskItem[] {
  const options = { workspace: world };
  if (mode === "make") return soloQ(items, options);
  if (mode === "decide") return decQ(items, options);
  if (mode === "owed") return segQ(items, options);
  if (mode === "admin") return adminOpen(items, options);
  if (mode === "delegated") return delQ(items, options);
  return items.filter((item) => item.world === world && item.state === "open" && item.inQueue === false);
}

function Today(props: {
  counts: ReturnType<typeof queueCounts>;
  p1: number;
  admin: number;
  aged: number;
  resolvedToday: number;
  resolvedWeek: number;
  cameIn: number;
  plan: DayBlock[];
  current: DayBlock;
  activeWorld: string;
  decisions: DeskItem[];
  make: DeskItem[];
  onYes: (id: string) => void;
  onNo: (id: string) => void;
  onDeck: () => void;
  onQueue: () => void;
  onIntake: () => void;
  owed: DeskItem[];
}) {
  const inProgress = props.counts.make;
  const makeHot = inProgress >= 5;
  const p1Hot = props.p1 >= 8 && props.p1 <= 10;
  const brief = props.current.kind === "brief" || props.current.kind === "before";
  const copy = railCopy(props.current, vis(props.current, props.activeWorld), props.activeWorld);
  const shown = brief ? props.decisions : props.make;
  return (
    <div>
      <div className="cr-score">
        <article className={`cr-stat ${makeHot ? "is-hot" : ""}`}>
          <span className="cr-kicker">{t("Make in progress")}</span>
          <strong>{inProgress}<small> / 5</small></strong>
        </article>
        <article className="cr-stat">
          <span className="cr-kicker">{t("Decisions waiting")}</span>
          <strong>{props.counts.decide}</strong>
        </article>
        <article className={`cr-stat ${props.p1 > 10 ? "is-over" : p1Hot ? "is-hot" : ""}`}>
          <span className="cr-kicker">{t("P1 alive")}</span>
          <strong>{props.p1}<small> / 10</small></strong>
        </article>
        <article className={`cr-stat ${props.admin > 15 ? "is-over" : props.admin === 15 ? "is-hot" : ""}`}>
          <span className="cr-kicker">{t("Admin open")}</span>
          <strong>{props.admin}<small> / 15</small></strong>
        </article>
        <article className="cr-stat">
          <span className="cr-kicker">{t("Resolved today")}</span>
          <strong>{props.resolvedToday}<small> · {props.resolvedWeek} {t("wk")}</small></strong>
        </article>
      </div>
      <div className="cr-today">
        <div>
          <div className="cr-rail-head">
            <span className="cr-kicker">{t("Today's schedule (")}{props.activeWorld})</span>
            <span className="cr-muted">{t("60s refresh")}</span>
          </div>
          <div className="cr-rail" data-testid="certo-run-rail">
            {props.plan.filter((block) => block.kind !== "wake").map((block) => {
              const visible = vis(block, props.activeWorld);
              const now = block.start === props.current.start && block.kind === props.current.kind;
              const text = railCopy(block, visible, props.activeWorld);
              return (
                <article className={`cr-block ${visible ? "" : "is-muted"} ${now ? "is-now" : ""}`} key={`${block.kind}-${block.start}`}>
                  <span className="cr-block-time">{block.start}–{block.end}</span>
                  <div className="cr-block-title"><strong>{t(text.name)}</strong>{now && <span className="cr-badge">{t("NOW")}</span>}</div>
                  <p>{t(text.sub)}</p>
                </article>
              );
            })}
          </div>
          {props.aged > 0 && <p className="cr-flag">{props.aged} {t("admin older than 72 hours")}</p>}
        </div>
        {props.current.kind === "meetings" ? <section className="cr-panel cr-meeting-panel">
          <div className="cr-brief-head"><div><h2>{t("Meetings & Fronts")}</h2><p className="cr-muted">{t("Client meetings and internal coordination. Any promise made goes through Intake.")}</p></div><button className="cr-solid" onClick={props.onIntake} type="button">{t("Run It Through Intake →")}</button></div>
          <div className="cr-meeting-rule"><strong>{t("Meeting Discipline Rule")}</strong><p>{t("Capture deliverables in real-time. If you promised a concrete date, record it before closing the call.")}</p></div>
          <div className="cr-meeting-followups"><span className="cr-kicker">{t("Active owed to me follow-ups (")}{props.owed.length})</span>{props.owed.slice(0, 4).map((item) => <div className="cr-row" key={item.id}><p>{item.deliverable || item.title}</p><span>{item.assigneeName || t("Unassigned")}</span></div>)}</div>
        </section> : <section className="cr-panel">
          <div className="cr-brief-head">
            <h2>{props.current.start !== "00:00" ? `${props.current.start} ` : ""}{t(copy.name)}</h2>
            <button className="cr-solid" onClick={brief ? props.onDeck : props.onQueue} type="button">
              {brief ? t("Open Decide Deck →") : t("Open the queue →")}
            </button>
          </div>
          {brief ? (
            <div className="cr-synthesis" data-testid="certo-run-empty">
              <strong>{t("Morning synthesis")}</strong>
              <p>
                {props.decisions.length === 0
                  ? t("Nothing is waiting on a yes or no.")
                  : t("{count} decisions waiting in {world}. Review each before deciding.", { count: props.decisions.length, world: props.activeWorld })}
              </p>
            </div>
          ) : (
            <p className="cr-muted">{t(copy.sub)}{props.cameIn > 0 ? t(" · {count} came in today.", { count: props.cameIn }) : ""}</p>
          )}
          {shown.length === 0 && <p className="cr-muted">{t("Nothing open in this block.")}</p>}
          {shown.slice(0, 6).map((item) => (
            <article className="cr-decision" key={item.id}>
              <div>
                <span className={`cr-pri ${item.priority === "P1" ? "is-p1" : ""}`}>{item.priority}</span>
                <h3>{item.title}</h3>
              </div>
              {brief ? (
                <div className="cr-actions">
                  <button className="cr-yes" onClick={() => props.onYes(item.id)} type="button">{t("Yes")}</button>
                  <button className="cr-no" onClick={() => props.onNo(item.id)} type="button">{t("No")}</button>
                </div>
              ) : null}
            </article>
          ))}
        </section>}
      </div>
    </div>
  );
}



function Projects(props: {
  items: DeskItem[];
  view: ProjectView;
  world: string;
  onView: (view: ProjectView) => void;
}) {
  const groups = new Map<string, DeskItem[]>();
  props.items.forEach((item) => {
    const name = item.epic || item.title;
    groups.set(name, [...(groups.get(name) || []), item]);
  });
  const columns = STAGES.map((stage) => ({
    stage,
    cards: [...groups.entries()].filter(([, rows]) => stageOf(rows[0]) === stage),
  }));
  return (
    <div>
      <div className="cr-row">
        <RunTabs label={t("Project views")} value={props.view} onChange={props.onView} panelId="cr-project-panel" options={[
          { value: "pipeline", label: `${t("Pipeline Board")} ${groups.size}` }, { value: "delivery", label: `${t("Delivery Rows")} ${props.items.length}` }, { value: "portfolio", label: t("Portfolio Sheets") },
        ]} />
        {props.view === "pipeline" && (
          <button
            className="cr-ghost"
            onClick={() => void copyText(pipelineText(props.world, columns))}
            type="button"
          >
            {t("Copy pipeline update")}</button>
        )}
      </div>
      <div id="cr-project-panel" role="tabpanel" aria-labelledby={`cr-project-panel-tab-${props.view}`}>
      {props.view === "pipeline" && (
        <div className="cr-board">
          {columns.map((column) => (
            <section className="cr-col" key={column.stage}>
              <header><span>{t(column.stage)}</span><span>{column.cards.length}</span></header>
              {column.cards.length === 0 && <p className="cr-muted">{t("Nothing in this stage.")}</p>}
              {column.cards.map(([name, rows]) => (
                <article className="cr-pcard" key={name}>
                  <span className="cr-kicker">{rows[0]?.clientEntity || props.world}</span>
                  <h3>{name}</h3>
                  <p className="cr-next">{t("Next:")} {rows.find((row) => row.nextStep)?.nextStep || rows[0]?.title}</p>
                  <p className="cr-muted">{rows.length} {t("open items ·")} {rows.filter((row) => row.decision === "make").length} {t("solo")}</p>
                </article>
              ))}
            </section>
          ))}
        </div>
      )}
      {props.view === "delivery" && (
        <div>
          {groups.size === 0 && <p className="cr-panel">{t("No delivery rows in this world.")}</p>}
          {[...groups.entries()].map(([name, rows]) => (
            <DeliveryCard key={name} name={name} rows={rows} />
          ))}
        </div>
      )}
      {props.view === "portfolio" && (
        <div>
          <div className="cr-meters">
            <article className="cr-meter"><span className="cr-kicker">{t("Monthly revenue")}</span><strong>—</strong></article>
            <article className="cr-meter"><span className="cr-kicker">{t("Team cost")}</span><strong>—</strong></article>
            <article className="cr-meter"><span className="cr-kicker">{t("Margin")}</span><strong>—</strong></article>
            <article className="cr-meter"><span className="cr-kicker">{t("Overdue 30+")}</span><strong className="cr-over">—</strong></article>
          </div>
          {groups.size === 0 && <p className="cr-panel">{t("No portfolio sheet in this world.")}</p>}
          {[...groups.entries()].map(([name, rows]) => (
            <details className="cr-sheet" key={name}>
              <summary>
                <span><strong>{name}</strong><br /><span className="cr-muted">{rows.length} {t("open items")}</span></span>
                <span className="cr-muted">{t("No sheet yet")}</span>
              </summary>
              {rows.map((row) => <p key={row.id}>{row.title}</p>)}
            </details>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

function stageOf(item: DeskItem | undefined): (typeof STAGES)[number] {
  const found = STAGES.find((stage) => item?.tags.includes(stage) || item?.feature === stage);
  return found || "Discovery";
}

function pipelineText(world: string, columns: { stage: string; cards: [string, DeskItem[]][] }[]): string {
  return [t("Pipeline · {world}", { world }), ...columns.map((column) => `${t(column.stage)}: ${column.cards.map(([name]) => name).join(", ") || "—"}`)].join("\n");
}

function DeliveryCard({ name, rows }: { name: string; rows: DeskItem[] }) {
  const first = rows[0];
  const light = first?.health || "";
  const [note, setNote] = useState(first?.unblock || "");
  async function paint(next: Health) {
    if (!first) return;
    await setRunHealth(first.id, light === next ? "" : next);
  }
  return (
    <article className="cr-sheet">
      <div className="cr-row">
        <div>
          <h3 style={{ margin: 0 }}>{name}</h3>
          <p className="cr-muted">{rows.length} {t("open items")}</p>
        </div>
        <div className="cr-lights">
          {(["green", "amber", "red"] as Health[]).map((color) => (
            <button aria-pressed={light === color} data-light={color} key={color} onClick={() => void paint(color)} type="button">{t(color.toUpperCase())}</button>
          ))}
        </div>
      </div>
      {rows.map((row) => (
        <p key={row.id}>• {row.title} <span className="cr-muted">{row.assigneeName}</span></p>
      ))}
      <form
        className="cr-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (first) void setRunUnblock(first.id, note);
        }}
      >
        <label className="cr-kicker">{t("What I must do to unblock")}</label>
        <input className="wide" onChange={(event) => setNote(event.target.value)} placeholder={t("e.g. Can Raúl confirm API credentials…")} value={note} />
        <button className="cr-ghost" type="submit">{t("Save")}</button>
      </form>
    </article>
  );
}

function Team(props: { view: TeamView; world: string; storageScope: string; onView: (view: TeamView) => void }) {
  const storageKey = `${props.storageScope}:${props.world}`;
  const [rows, setRows] = useState<AllocRow[]>(() => loadAlloc(storageKey));
  const [person, setPerson] = useState("");
  const [project, setProject] = useState("");
  const [pct, setPct] = useState("20");
  const [refusal, setRefusal] = useState<{ person: string; load: number } | null>(null);
  useEffect(() => { setRows(loadAlloc(storageKey)); }, [storageKey]);
  const people = [...new Set(rows.map((row) => row.person))];
  const cap = () => DEFAULT_CAP_MONTH;
  function save(next: AllocRow[]) {
    setRows(next);
    storeAlloc(storageKey, next);
  }
  return (
    <div>
      <p className="cr-muted">{t("Allocation planning is saved only on this browser. Cloud sync and week-by-week planning are not connected yet.")}</p>
      <div className="cr-row">
        <RunTabs label={t("Team views")} value={props.view} onChange={props.onView} panelId="cr-team-panel" options={[
          { value: "allocation", label: `${t("Team Allocation")} ${people.length}` }, { value: "utilization", label: t("Utilization Matrix") }, { value: "lead", label: t("How I Lead & Feedback") },
        ]} />
        <button className="cr-ghost" onClick={() => void copyText(allocText(props.world, rows))} type="button">{t("Copy for Lucy")}</button>
      </div>
      <div id="cr-team-panel" role="tabpanel" aria-labelledby={`cr-team-panel-tab-${props.view}`}>
      {props.view === "lead" && (
        <div>
          <div className="cr-principles">
            {PRINCIPLES.map(([title, body]) => (
              <article className="cr-principle" key={title}>
                <h3>{t(title).toUpperCase()}</h3>
                <p>{t(body)}</p>
              </article>
            ))}
          </div>
          <section className="cr-panel" style={{ marginTop: 12 }}>
            <h2>{t("Team keeper test & 14-day 4A feedback")}</h2>
            {people.length === 0 && <p className="cr-muted">{t("No one is on the team list in this world yet.")}</p>}
            {people.map((name) => (
              <div className="cr-alloc-row" key={name}>
                <div>
                  <strong>{name}</strong>
                  <p className="cr-muted">{t("Keeper: not set · Last feedback: —")}</p>
                </div>
                <span className="cr-muted">{t("Keep")}</span>
              </div>
            ))}
          </section>
        </div>
      )}
      {props.view === "allocation" && (
        <div>
          <div className="cr-meters">
            <article className="cr-meter"><span className="cr-kicker">{t("People allocated")}</span><strong>{people.length}</strong></article>
            <article className="cr-meter"><span className="cr-kicker">{t("FTE allocated")}</span><strong>{fteOf(rows).toFixed(1)}</strong></article>
            <article className="cr-meter"><span className="cr-kicker">{t("Hours / week")}</span><strong>{Math.round(hoursWeek(rows, cap))} {t("h")}</strong></article>
            <article className="cr-meter"><span className="cr-kicker">{t("Available FTE")}</span><strong className="cr-good">{availableFte(rows).toFixed(1)}</strong></article>
            <article className="cr-meter"><span className="cr-kicker">{t("Over-allocated")}</span><strong className={overAllocated(rows).length ? "cr-over" : ""}>{overAllocated(rows).length}</strong></article>
          </div>
          <form
            className="cr-panel cr-form"
            onSubmit={(event) => {
              event.preventDefault();
              const next = [...rows, { person: person.trim(), project: project.trim(), pct: Number(pct) || 0 }];
              const check = checkAllocation(next, person.trim());
              if (!check.ok) {
                setRefusal({ person: check.person, load: Math.round(check.load) });
                return;
              }
              if (!person.trim() || !project.trim()) return;
              setRefusal(null);
              save(next);
              setPerson("");
              setProject("");
            }}
          >
            <span className="cr-kicker">{t("Allocate a person (100% hard cap)")}</span>
            <input aria-label={t("Person")} onChange={(event) => setPerson(event.target.value)} placeholder={t("Person")} value={person} />
            <input aria-label={t("Project")} onChange={(event) => setProject(event.target.value)} placeholder={t("Project or front")} value={project} />
            <input aria-label={t("Percent")} onChange={(event) => setPct(event.target.value)} type="number" value={pct} />
            <button className="cr-solid" type="submit">{t("+ Add allocation")}</button>
          </form>
          {refusal && <p className="cr-flag" role="alert">{t("{person} is at {load}%. The 100% cap holds.", refusal)}</p>}
          {people.length === 0 && <p className="cr-panel">{t("No allocation in this world.")}</p>}
          {[...groupProjects(rows).entries()].map(([projectName, assigned]) => (
            <section className="cr-sheet" key={projectName}>
              <div className="cr-row">
                <strong>{projectName}</strong>
                <span>{t("Total:")} {assigned.reduce((sum, row) => sum + row.pct, 0)}%</span>
              </div>
              {assigned.map((row) => (
                <div className="cr-alloc-row" key={`${row.person}-${row.pct}`}>
                  <span>{row.person}</span>
                  <span>{row.pct}% ({Math.round(hoursWeek([row], cap))} {t("h/wk)")}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
      {props.view === "utilization" && <Utilization rows={rows} world={props.world} />}
      </div>
    </div>
  );
}

function groupProjects(rows: AllocRow[]): Map<string, AllocRow[]> {
  const groups = new Map<string, AllocRow[]>();
  rows.forEach((row) => groups.set(row.project, [...(groups.get(row.project) || []), row]));
  return groups;
}

function Utilization({ rows }: { rows: AllocRow[]; world: string }) {
  const today = zoneToday();
  const start = mondayOf(today);
  const weeks = Array.from({ length: 8 }, (_, index) => addDays(start, index * 7));
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const people = [...new Set(rows.map((row) => row.person))];
  const days = workingDaysOfMonth(year, month).length;
  return (
    <div>
      <p className="cr-muted">{t("Person × 8 weeks. Red over 100%, green 85–100%.")} {runMonth(`${year}-${String(month).padStart(2, "0")}-01`)} {year} {t("computed on")} {days} {t("working days.")}</p>
      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th>{t("Team member")}</th>
              <th>{t("Cap")}</th>
              {weeks.map((week) => <th key={week}>{formatDate(week)}</th>)}
              <th>{runMonth(today)} {year}</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && (
              <tr><td colSpan={11}>{t("No one is allocated this month.")}</td></tr>
            )}
            {people.map((person) => {
              const load = loadOf(rows, person);
              const hours = monthHours({
                person,
                year,
                month,
                capMonth: DEFAULT_CAP_MONTH,
                loadOnWeek: (week) => (week === start ? load : 0),
              });
              return (
                <tr key={person}>
                  <td>{person}</td>
                  <td>{DEFAULT_CAP_MONTH}{t("h")}</td>
                  {weeks.map((week) => {
                    const value = week === start ? load : 0;
                    const tone = utilClass(value);
                    return <td className={tone === "bad" ? "is-bad" : tone === "ok" ? "is-ok" : tone === "zero" ? "is-zero" : ""} key={week}>{value}%</td>;
                  })}
                  <td>{Math.round(hours.hours)} {t("h")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Week(props: { world: string; today: string; items: DeskItem[] }) {
  const start = mondayOf(props.today);
  const days = Array.from({ length: 5 }, (_, index) => addDays(start, index));
  return (
    <div>
      <div className="cr-row">
        <div>
          <h2 style={{ margin: 0 }}>{t("Week time blocking ·")} {props.world}</h2>
          <p className="cr-muted">{t("Morning Make fronts, midday protected time, and afternoon focus.")}</p>
        </div>
        <button className="cr-ghost" onClick={() => void copyText(weekText(props.world, days, props.items))} type="button">{t("Copy blocks for Lucy")}</button>
      </div>
      <div className="cr-budget">
        <span>{t("Weekly attention budget target: 60% commercial / 25% projects / 15% admin")}</span>
        <strong className="cr-good">{t("Target 60% / 25% / 15%")}</strong>
        <div className="cr-bar-track" aria-hidden="true"><span /><span /><span /></div>
      </div>
      <div className="cr-week">
        {days.map((iso) => {
          const owner = morningWorld(iso);
          const blocks = dayPlan(iso).filter((block) => block.kind !== "wake" && vis(block, props.world));
          return (
            <section className="cr-day" key={iso}>
              <div>
                <strong>{dayName(iso)}</strong>
                <p className="cr-muted">{owner}</p>
              </div>
              {blocks.map((block) => {
                const visible = vis(block, props.world);
                const focus = block.kind === "make" && visible;
                const note = block.kind === "make"
                  ? (visible ? (props.items[0]?.title || t("No meetings")) : t("Use for {world}", { world: owner }))
                  : t(railCopy(block, visible, props.world).name);
                return (
                  <div className={`cr-slot ${focus ? "is-focus" : ""} ${visible ? "" : "is-quiet"}`} key={`${iso}-${block.start}`}>
                    <span className="cr-muted">{block.start}–{block.end}</span>
                    <strong>{block.kind === "make" ? t("Make (2h)") : note}</strong>
                    {block.kind === "make" && <span>{note}</span>}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function weekText(world: string, days: string[], items: DeskItem[]): string {
  return [
    `${t("Week time blocking ·")} ${world}`,
    ...days.flatMap((iso) => dayPlan(iso).filter((block) => block.kind !== "wake").map((block) => `${dayName(iso)} ${block.start}–${block.end} ${t(block.name)}`)),
    items[0] ? t("First Make: {title}", { title: items[0].title }) : t("No Make item yet."),
  ].join("\n");
}

function Intake(props: {
  gate: Partial<Record<GateKey, boolean>>;
  title: string;
  lane: Lane;
  decision: Decision;
  client: string;
  deliverable: string;
  doneWhen: string;
  nextStep: string;
  onGate: (gate: Partial<Record<GateKey, boolean>>) => void;
  onTitle: (value: string) => void;
  onLane: (lane: Lane) => void;
  onDecision: (decision: Decision) => void;
  onClient: (value: string) => void;
  onDeliverable: (value: string) => void;
  onDone: (value: string) => void;
  onNext: (value: string) => void;
  onSave: () => void;
}) {
  const dest = gateDest(props.gate);
  const title = checkTitle(props.title);
  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>{t("Intake Gate & PBI Creator")}</h2>
      <p className="cr-muted">{t("Five questions before any commitment enters the desk. Protect the queue from noise.")}</p>
      <div className="cr-split">
        <div>
          <div className="cr-row"><span className="cr-kicker">{t("The 5 questions")}</span><button className="cr-link" onClick={() => props.onGate({})} type="button">{t("Reset")}</button></div>
          {GATE_QUESTIONS.map((question, index) => (
            <article className="cr-question" key={question.key}>
              <header>
                <strong>{index + 1}. {t(question.question)}</strong>
                <span className="cr-choice">
                  <button aria-pressed={props.gate[question.key] === true} className="cr-ghost" onClick={() => props.onGate({ ...props.gate, [question.key]: true })} type="button">{t("Yes")}</button>
                  <button aria-pressed={props.gate[question.key] === false} className="cr-ghost" onClick={() => props.onGate({ ...props.gate, [question.key]: false })} type="button">{t("No")}</button>
                </span>
              </header>
              <p>{t(question.hint)}</p>
            </article>
          ))}
        </div>
        <aside className={`cr-preview ${dest ? "is-ready" : ""}`}>
          {!dest && <p>{t("Answer the questions on the left to evaluate this intake.")}</p>}
          {dest && !dest.pbi && <div><h2>{t(dest.name)}</h2><p>{t(dest.detail)}</p></div>}
          {dest?.pbi && (
            <form className="cr-form" onSubmit={(event) => { event.preventDefault(); props.onSave(); }}>
              <h2>{t("Create the PBI")}</h2>
              <p>{t(dest.detail)}</p>
              <label className="cr-field-label">{t("Title")}<input aria-label={t("Title")} onChange={(event) => props.onTitle(event.target.value)} placeholder={t("Verb + object + for whom")} value={props.title} /></label>
              <span className={title.ok ? "cr-muted" : "cr-over"}>{title.words} {t("/ 12 words")}</span>
              {!title.ok && props.title && <p role="status" className="cr-over">{t("Use 1–12 words without dates, stars or prefixes.")}</p>}
              <label className="cr-field-label">{t("Client")}<input aria-label={t("Client")} onChange={(event) => props.onClient(event.target.value)} value={props.client} /></label>
              <label className="cr-field-label">{t("Deliverable")}<input aria-label={t("Deliverable")} onChange={(event) => props.onDeliverable(event.target.value)} value={props.deliverable} /></label>
              <label className="cr-field-label">{t("Done when")}<input aria-label={t("Done when")} onChange={(event) => props.onDone(event.target.value)} value={props.doneWhen} /></label>
              <label className="cr-field-label">{t("Next step")}<input aria-label={t("Next step")} onChange={(event) => props.onNext(event.target.value)} value={props.nextStep} /></label>
              <div className="cr-actions">
                {(["commercial", "projects", "admin"] as Lane[]).map((lane) => (
                  <button aria-pressed={props.lane === lane} className="cr-ghost" key={lane} onClick={() => props.onLane(lane)} type="button">{t(lane)}</button>
                ))}
                {(["make", "decide", "delegate", "admin_batch"] as Decision[]).map((decision) => (
                  <button aria-pressed={props.decision === decision} className="cr-ghost" key={decision} onClick={() => props.onDecision(decision)} type="button">{t(decision)}</button>
                ))}
              </div>
              {props.lane === "admin" && props.decision === "make" && <p className="cr-flag">{t("Admin is never Make.")}</p>}
              <button className="cr-solid" disabled={!title.ok} type="submit">{t("Save to this world")}</button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}

function Close(props: {
  resolved: number;
  cameIn: number;
  promised: DeskItem[];
  make: DeskItem[];
  top3: string[];
  today: string;
  world: string;
  onToggle: (id: string) => void;
  onDone: (id: string) => void;
  onAdd: (title: string, date: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(props.today);
  const forward = props.resolved >= props.cameIn;
  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>{t("17:30 Close the day ·")} {props.world}</h2>
      <p className="cr-muted">{t("Four numbered steps. Leave the desk clean, promises intact, hand-off prepared.")}</p>
      <section className="cr-step">
        <h2><span className="cr-num">1</span> {t("What you resolved today vs came in")}</h2>
        <div className="cr-pair">
          <div><span className="cr-kicker">{t("Resolved today")}</span><strong className="cr-good">{props.resolved}</strong></div>
          <div><span className="cr-kicker">{t("Came in as PBIs")}</span><strong>{props.cameIn}</strong></div>
        </div>
        <p className="cr-banner">{forward ? t("Desk moved forward: resolved more than entered.") : t("More came in than got resolved. Drop or delegate before you leave.")}</p>
      </section>
      <section className="cr-step">
        <h2><span className="cr-num">2</span> {t("Promised dates checklist")}</h2>
        <p className="cr-muted">{t("Promises to clients or the team made today. Check them off or add a pending one.")}</p>
        {props.promised.length === 0 && <p className="cr-muted">{t("No promised date is open.")}</p>}
        {props.promised.map((item) => (
          <label className="cr-pick" key={item.id}>
            <input onChange={() => props.onDone(item.id)} type="checkbox" />
            <span>{item.title} <span className="cr-muted">{formatDate(item.dueDate)}</span></span>
          </label>
        ))}
        <form
          className="cr-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            props.onAdd(title.trim(), date);
            setTitle("");
          }}
        >
          <input aria-label={t("Promised deliverable")} onChange={(event) => setTitle(event.target.value)} placeholder={t("Add another promised deliverable…")} value={title} />
          <input aria-label={t("Promised date")} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          <button className="cr-ghost" type="submit">{t("Add promise")}</button>
        </form>
      </section>
      <section className="cr-step">
        <h2><span className="cr-num">3</span> {t("Three for tomorrow")}<span className="cr-good" style={{ marginLeft: "auto", fontSize: 14 }}>{props.top3.length} {t("of 3 selected")}</span></h2>
        {props.make.length === 0 && <p className="cr-muted">{t("Nothing is in Make yet.")}</p>}
        {props.make.slice(0, 12).map((item) => (
          <label className={`cr-pick ${props.top3.includes(item.id) ? "is-on" : ""}`} key={item.id}>
            <input checked={props.top3.includes(item.id)} onChange={() => props.onToggle(item.id)} type="checkbox" />
            <span>{item.title}<br /><span className="cr-muted">{item.priority}</span></span>
          </label>
        ))}
      </section>
      <section className="cr-step">
        <h2><span className="cr-num">4</span> {t("Hand-off")}</h2>
        <p>{props.top3.length === 3 ? t("Hand-off ready. Three for tomorrow are chosen.") : t("Choose three for tomorrow before the hand-off.")}</p>
        <button
          className="cr-solid"
          onClick={() => void copyText([
            `${t("Close the day")} · ${props.world} · ${formatDate(props.today)}`,
            t("Resolved {resolved}. Came in {incoming}.", { resolved: props.resolved, incoming: props.cameIn }),
            ...props.make.filter((item) => props.top3.includes(item.id)).map((item) => t("Tomorrow: {title}", { title: item.title })),
          ].join("\n"))}
          type="button"
        >
          {t("Copy hand-off for Lucy")}</button>
      </section>
    </div>
  );
}

function Manifesto(props: { until: number | null; onClose: () => void; onStart: () => void }) {
  const [text, setText] = useState(() => {
    try { return window.localStorage.getItem("certo-run-manifesto") || DEFAULT_MANIFESTO; } catch { return DEFAULT_MANIFESTO; }
  });
  const [editing, setEditing] = useState(false);
  const [checkIn, setCheckIn] = useState(false);
  const [sleep, setSleep] = useState("7");
  const [mood, setMood] = useState("");
  const [left, setLeft] = useState("");
  useEffect(() => {
    if (!props.until) return;
    const tick = () => {
      const ms = Math.max(0, props.until! - Date.now());
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      setLeft(`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [props.until]);
  return (
    <RunDialog title={t("Morning Read · The Manifesto")} onClose={props.onClose}>
      <div data-testid="certo-run-manifesto">
        {props.until ? <p className="cr-clock">{left}</p> : checkIn ? (
          <div className="cr-manifesto">
            <p>{t("Hours of sleep")}</p>
            <input aria-label={t("Hours of sleep")} className="cr-field" onChange={(event) => setSleep(event.target.value)} type="number" value={sleep} />
            <div className="cr-moods">
              {MOOD_KEYS.map((key) => (
                <button aria-pressed={mood === key} className="cr-ghost" key={key} onClick={() => setMood(key)} type="button">{t(key.replace("_", " "))}</button>
              ))}
            </div>
            <button className="cr-solid" onClick={props.onStart} type="button">{t("Focus 25 min")}</button>
          </div>
        ) : editing ? (
          <textarea aria-label={t("Manifesto")} className="cr-field wide" onChange={(event) => setText(event.target.value)} rows={16} value={text} />
        ) : (
          <div className="cr-manifesto">{text === DEFAULT_MANIFESTO ? t(DEFAULT_MANIFESTO) : text}</div>
        )}
        {!props.until && (
          <footer>
            <button
              className="cr-link"
              onClick={() => {
                if (editing) {
                  try { window.localStorage.setItem("certo-run-manifesto", text); } catch { /* private mode */ }
                }
                else if (text === DEFAULT_MANIFESTO) setText(t(DEFAULT_MANIFESTO));
                setEditing((value) => !value);
              }}
              type="button"
            >
              {editing ? t("Save manifesto") : t("Edit manifesto")}
            </button>
            {!checkIn && <button className="cr-solid" onClick={() => setCheckIn(true)} type="button">{t("Read. Now the check-in →")}</button>}
            {checkIn && <button className="cr-ghost" onClick={props.onClose} type="button">{t("Close")}</button>}
          </footer>
        )}
      </div>
    </RunDialog>
  );
}

function loadAlloc(world: string): AllocRow[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(ALLOC_KEY) || "{}") as Record<string, AllocRow[]>;
    const rows = raw[world];
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) => row && typeof row.person === "string" && typeof row.project === "string").map((row) => ({
      person: row.person,
      project: row.project,
      pct: Number(row.pct) || 0,
    }));
  } catch {
    return [];
  }
}

function storeAlloc(world: string, rows: AllocRow[]) {
  try {
    const raw = JSON.parse(window.localStorage.getItem(ALLOC_KEY) || "{}") as Record<string, AllocRow[]>;
    raw[world] = rows;
    window.localStorage.setItem(ALLOC_KEY, JSON.stringify(raw));
  } catch {
    /* private mode */
  }
}

function allocText(world: string, rows: AllocRow[]): string {
  if (rows.length === 0) return `${t("Team allocation · {world}", { world })}\n${t("No one is allocated.")}`;
  return [t("Team allocation · {world}", { world }), ...rows.map((row) => `${row.person} · ${row.project} · ${row.pct}%`)].join("\n");
}

import { useEffect, useMemo, useState } from "react";
import { useRunItems } from "../../data/collections";
import { agedAdminCount } from "../../lib/certoRun/caps";
import {
  DEFAULT_TEMPLATE,
  currentBlock,
  dayPlan,
  muteLabel,
  nowChip,
  vis,
  type DayBlock,
} from "../../lib/certoRun/dayplan";
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
import { checkTitle, gateDest, type GateKey, GATE_QUESTIONS } from "../../lib/certoRun/intake";
import { DEFAULT_MANIFESTO } from "../../lib/certoRun/manifesto";
import { runDocToDeskItem } from "../../lib/certoRun/store";
import type { DeskItem } from "../../lib/certoRun/types";
import {
  clearRunTop3,
  completeRunItem,
  createRunItem,
  delegateRunItem,
  moveRunItemToMake,
  renegotiateRunItem,
  setRunTop3,
} from "../../lib/certoRun/writes";
import { RUN_WORLDS, type Decision, type Lane, type RunWorld } from "../../lib/certoRun/vocab";
import { tx } from "./copy";
import "./certo-run.css";

export type RunTab = "today" | "queue" | "projects" | "team" | "week" | "intake" | "close" | "life";
type QueueMode = "make" | "decide" | "owed" | "admin" | "delegated" | "unsorted";

interface Props {
  workspaceId: string;
  user: { uid: string; displayName?: string | null };
  tab: RunTab;
  onTab: (tab: RunTab) => void;
  onBack: () => void;
}

const WORLD_KEY = "certo-run-world";

function savedWorld(): RunWorld {
  try {
    const saved = window.localStorage.getItem(WORLD_KEY);
    if (saved === "Pure AI" || saved === "Boldr AI" || saved === "Personal") return saved;
  } catch {
    /* private mode */
  }
  return "Pure AI";
}

function localToday(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

export function CertoRunDesk({ workspaceId, user, tab, onTab, onBack }: Props) {
  const [mode, setMode] = useState<QueueMode>("make");
  const [form, setForm] = useState<{ id: string; kind: "delegate" | "date" | "drop" } | null>(null);
  const [refusal, setRefusal] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());
  const [manifestoOpen, setManifestoOpen] = useState(false);
  const [focusUntil, setFocusUntil] = useState<number | null>(null);
  const [gate, setGate] = useState<Partial<Record<GateKey, boolean>>>({});
  const [draftTitle, setDraftTitle] = useState("");
  const [draftLane, setDraftLane] = useState<Lane>("projects");
  const [draftDecision, setDraftDecision] = useState<Decision>("make");
  const [error, setError] = useState("");
  const [world, setWorld] = useState<RunWorld>(savedWorld);
  const rows = useRunItems(workspaceId);
  const items = useMemo(
    () =>
      rows
        .map((row) => runDocToDeskItem(row.id, row, { id: workspaceId }))
        .filter((item): item is DeskItem => item !== null),
    [rows, workspaceId],
  );
  const today = localToday();
  const personal = world === "Personal";

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      setMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const worldItems = items.filter((item) => item.world === world);
  const options = { workspace: world };
  const counts = queueCounts(worldItems, options);
  const plan = useMemo(() => dayPlan(today, DEFAULT_TEMPLATE), [today]);
  const chip = nowChip(plan, world, minutes);
  const activeWorld = world;
  const current = currentBlock(plan, minutes);
  const gap = current.kind === "before" || current.kind === "after";
  const nowVisible = !gap && vis(current, activeWorld);
  const tabs: RunTab[] = personal
    ? ["today", "life", "intake", "close"]
    : ["today", "queue", "projects", "team", "week", "intake", "close"];
  const queue = queueFor(worldItems, world, mode);
  const top3 = worldItems.filter((item) => item.runTop3Date === today).map((item) => item.id);

  function chooseWorld(next: RunWorld) {
    setWorld(next);
    try { window.localStorage.setItem(WORLD_KEY, next); } catch { /* private mode */ }
    const shared: RunTab[] = ["today", "queue", "projects", "team", "week", "intake", "close"];
    const life: RunTab[] = ["today", "life", "intake", "close"];
    if (!(next === "Personal" ? life : shared).includes(tab)) onTab("today");
  }

  async function onMake(id: string) {
    setError("");
    const result = await moveRunItemToMake(worldItems, world, id);
    if (!result.ok) setRefusal(result.current.map((row) => row.title));
    else setRefusal([]);
  }

  return (
    <section className="cr-desk" data-testid="certo-run-desk" data-world={world}>
      <div className="cr-top">
        <h1>Certo Run</h1>
        <p className="cr-lede">{tx("lede")}</p>
        <button className="do-button" onClick={onBack} type="button">{tx("back")}</button>
        <button className="do-button" onClick={() => setManifestoOpen(true)} type="button">{tx("manifesto")}</button>
      </div>
      <div className="cr-worlds" aria-label="Worlds" data-testid="certo-run-worlds">
        {RUN_WORLDS.map((name) => (
          <button
            aria-pressed={name === world}
            data-testid={`run-world-${name}`}
            key={name}
            onClick={() => chooseWorld(name)}
            type="button"
          >
            {name} <span>{openCount(items, name)}</span>
          </button>
        ))}
      </div>
      {openCount(worldItems, world) === 0 && <p className="cr-panel" data-testid="certo-run-empty">{tx("noWork")}</p>}
      <p className="cr-muted" data-testid="certo-run-now">
        {nowVisible
          ? `${tx("now")}: ${current.name} ${current.start}`
          : gap
            ? `${tx("next")} ${chip.label} ${chip.time}`
            : `${tx("outside")} · ${tx("next")} ${chip.label} ${chip.time}`}
      </p>
      <div className="cr-tabs" role="tablist">
        {tabs.map((name) => (
          <button aria-pressed={tab === name} key={name} onClick={() => onTab(name)} type="button">{tx(name)}</button>
        ))}
      </div>
      {refusal.length > 0 && (
        <div className="cr-flag" data-testid="certo-run-cap" role="status">
          {tx("cap")} {refusal.join(" · ")}
        </div>
      )}
      {error && <p className="cr-flag" role="alert">{error}</p>}
      {tab === "today" && (
        <Today
          activeWorld={activeWorld}
          admin={adminOpen(worldItems, options).length}
          aged={agedAdminCount(worldItems, options, today)}
          counts={counts}
          current={currentBlock(plan, minutes)}
          p1={p1Alive(worldItems, options).length}
          plan={plan}
          resolved={worldItems.filter((item) => item.state === "done").length}
        />
      )}
      {tab === "queue" && (
        <Queue
          form={form}
          items={queue}
          mode={mode}
          onDone={(id) => void completeRunItem(id, mode === "decide" ? "yes" : "done")}
          onDrop={(id) => setForm({ id, kind: "drop" })}
          onForm={setForm}
          onMake={(id) => void onMake(id)}
          onMode={setMode}
          onNo={(id) => void completeRunItem(id, "no")}
          onSave={async (value) => {
            if (!form) return;
            if (form.kind === "delegate") await delegateRunItem(form.id, value.who, value.date, "captain", value.context);
            if (form.kind === "date") await renegotiateRunItem(form.id, value.date);
            if (form.kind === "drop") await completeRunItem(form.id, "dropped", value.context || "Adds nothing");
            setForm(null);
          }}
        />
      )}
      {tab === "projects" && <Projects items={worldItems.filter((item) => item.state === "open" && item.epic)} />}
      {tab === "team" && <p className="cr-panel">{tx("teamEmpty")}</p>}
      {tab === "week" && <p className="cr-panel">{tx("weekEmpty")}</p>}
      {tab === "life" && <p className="cr-panel">{tx("lifeLede")}</p>}
      {tab === "intake" && (
        <Intake
          decision={draftDecision}
          gate={gate}
          lane={draftLane}
          onDecision={setDraftDecision}
          onGate={setGate}
          onLane={setDraftLane}
          onTitle={setDraftTitle}
          title={draftTitle}
          onSave={async () => {
            const created = await createRunItem({
              userId: user.uid,
              workspaceId,
              world,
              title: draftTitle,
              decision: draftDecision,
              lane: draftLane,
            });
            if (!created.ok) setError(tx("adminMake"));
            else setDraftTitle("");
          }}
        />
      )}
      {tab === "close" && (
        <Close
          make={soloQ(worldItems, options)}
          top3={top3}
          onToggle={async (id) => {
            if (top3.includes(id)) {
              await clearRunTop3(id);
              return;
            }
            const result = await setRunTop3(top3, id, today);
            if (!result.ok) setRefusal(result.current.map((row) => row.title));
          }}
        />
      )}
      {manifestoOpen && (
        <Manifesto
          until={focusUntil}
          onClose={() => { setManifestoOpen(false); setFocusUntil(null); }}
          onStart={() => setFocusUntil(Date.now() + 25 * 60_000)}
        />
      )}
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
  resolved: number;
  plan: DayBlock[];
  current: DayBlock;
  activeWorld: string;
}) {
  const inProgress = Math.min(5, props.counts.make);
  return (
    <div>
      <div className="cr-score">
        <div><span>{tx("inProgress")}</span><strong>{inProgress}<small> / 5</small></strong></div>
        <div><span>{tx("decisions")}</span><strong>{props.counts.decide}</strong></div>
        <div className={props.p1 > 10 ? "is-over" : ""}><span>{tx("p1")}</span><strong>{props.p1}<small> / 10</small></strong></div>
        <div className={props.admin > 15 ? "is-over" : ""}><span>{tx("adminOpen")}</span><strong>{props.admin}<small> / 15</small></strong></div>
        <div><span>{tx("resolved")}</span><strong>{props.resolved}</strong></div>
      </div>
      <div className="cr-rail" data-testid="certo-run-rail">
        {props.plan.map((block) => {
          const visible = vis(block, props.activeWorld);
          const now = block.start === props.current.start && block.kind === props.current.kind;
          return (
            <div className={`cr-card ${visible ? "" : "is-muted"} ${now ? "is-now" : ""}`} key={`${block.kind}-${block.start}`}>
              <span className="cr-muted">{block.start}–{block.end}</span>
              <strong>{visible ? block.name : muteLabel(block, props.activeWorld)}</strong>
            </div>
          );
        })}
        {props.aged > 0 && <p className="cr-flag">{props.aged} admin older than 72 hours</p>}
      </div>
    </div>
  );
}

function Queue(props: {
  mode: QueueMode;
  items: DeskItem[];
  form: { id: string; kind: "delegate" | "date" | "drop" } | null;
  onMode: (mode: QueueMode) => void;
  onDone: (id: string) => void;
  onNo: (id: string) => void;
  onMake: (id: string) => void;
  onDrop: (id: string) => void;
  onForm: (form: { id: string; kind: "delegate" | "date" | "drop" } | null) => void;
  onSave: (value: { who: string; date: string; context: string }) => void;
}) {
  const modes: QueueMode[] = ["make", "decide", "owed", "admin", "delegated", "unsorted"];
  const [who, setWho] = useState("");
  const [date, setDate] = useState("");
  const [context, setContext] = useState("");
  return (
    <div>
      <div className="cr-seg" role="tablist">
        {modes.map((name) => (
          <button aria-pressed={props.mode === name} key={name} onClick={() => props.onMode(name)} type="button">{tx(name)}</button>
        ))}
      </div>
      {props.items.length === 0 && <p className="cr-panel">{props.mode === "unsorted" ? tx("unsortedEmpty") : tx("empty")}</p>}
      {props.items.slice(0, 40).map((item) => (
        <article className="cr-card" key={item.id}>
          <h3>{item.title}</h3>
          <p className="cr-muted">{[item.priority, item.epic, item.assigneeName].filter(Boolean).join(" · ")}</p>
          <div className="cr-actions">
            {props.mode === "decide" ? (
              <>
                <button onClick={() => props.onDone(item.id)} type="button">{tx("yes")}</button>
                <button onClick={() => props.onNo(item.id)} type="button">{tx("no")}</button>
              </>
            ) : (
              <button onClick={() => props.onDone(item.id)} type="button">{tx("done")}</button>
            )}
            {props.mode === "unsorted" || props.mode === "owed" || props.mode === "admin" ? (
              <button data-testid={`make-${item.id}`} onClick={() => props.onMake(item.id)} type="button">{tx("makeThis")}</button>
            ) : props.mode === "make" || props.mode === "delegated" ? (
              <button onClick={() => props.onForm({ id: item.id, kind: "date" })} type="button">{tx("renegotiate")}</button>
            ) : null}
            <button onClick={() => props.onForm({ id: item.id, kind: "delegate" })} type="button">{tx("delegate")}</button>
            <button onClick={() => props.onDrop(item.id)} type="button">{tx("drop")}</button>
          </div>
          {props.form?.id === item.id && (
            <form
              className="cr-form"
              onSubmit={(event) => {
                event.preventDefault();
                props.onSave({ who, date, context });
                setWho("");
                setDate("");
                setContext("");
              }}
            >
              {props.form.kind === "delegate" && <input aria-label={tx("who")} onChange={(event) => setWho(event.target.value)} placeholder={tx("who")} value={who} />}
              {props.form.kind !== "drop" && <input aria-label={tx("date")} onChange={(event) => setDate(event.target.value)} type="date" value={date} />}
              <input aria-label={tx("context")} onChange={(event) => setContext(event.target.value)} placeholder={tx("context")} value={context} />
              <button className="do-button" type="submit">{tx("save")}</button>
              <button onClick={() => props.onForm(null)} type="button">{tx("cancel")}</button>
            </form>
          )}
        </article>
      ))}
    </div>
  );
}

function Projects({ items }: { items: DeskItem[] }) {
  const groups = new Map<string, DeskItem[]>();
  items.forEach((item) => {
    const name = item.epic || "No project";
    groups.set(name, [...(groups.get(name) || []), item]);
  });
  if (groups.size === 0) return <p className="cr-panel">{tx("projectsEmpty")}</p>;
  return (
    <div>
      {[...groups.entries()].map(([name, rows]) => (
        <article className="cr-card" key={name}>
          <h3>{name}</h3>
          <p className="cr-muted">{rows.length} open · {rows.filter((row) => row.priority === "P1").length} P1</p>
        </article>
      ))}
    </div>
  );
}

function Intake(props: {
  gate: Partial<Record<GateKey, boolean>>;
  title: string;
  lane: Lane;
  decision: Decision;
  onGate: (gate: Partial<Record<GateKey, boolean>>) => void;
  onTitle: (value: string) => void;
  onLane: (lane: Lane) => void;
  onDecision: (decision: Decision) => void;
  onSave: () => void;
}) {
  const dest = gateDest(props.gate);
  const title = checkTitle(props.title);
  return (
    <div className="cr-panel">
      {GATE_QUESTIONS.map((question) => (
        <div key={question.key}>
          <p>{question.question}</p>
          <div className="cr-actions">
            <button aria-pressed={props.gate[question.key] === true} onClick={() => props.onGate({ ...props.gate, [question.key]: true })} type="button">{tx("yes")}</button>
            <button aria-pressed={props.gate[question.key] === false} onClick={() => props.onGate({ ...props.gate, [question.key]: false })} type="button">{tx("no")}</button>
          </div>
        </div>
      ))}
      {dest && <p>{dest.name}. {dest.detail}</p>}
      {dest?.pbi && (
        <form className="cr-form" onSubmit={(event) => { event.preventDefault(); props.onSave(); }}>
          <input aria-label={tx("intakeTitle")} onChange={(event) => props.onTitle(event.target.value)} value={props.title} />
          <span className={title.ok ? "cr-muted" : "cr-flag"}>{title.words} / 12</span>
          <div className="cr-actions">
            {(["projects", "commercial", "admin"] as Lane[]).map((lane) => (
              <button aria-pressed={props.lane === lane} key={lane} onClick={() => props.onLane(lane)} type="button">{lane}</button>
            ))}
            {(["make", "decide", "delegate", "admin_batch"] as Decision[]).map((decision) => (
              <button aria-pressed={props.decision === decision} key={decision} onClick={() => props.onDecision(decision)} type="button">{decision}</button>
            ))}
          </div>
          {props.lane === "admin" && props.decision === "make" && <p className="cr-flag">{tx("adminMake")}</p>}
          <button className="do-button" disabled={!title.ok} type="submit">{tx("intakeSave")}</button>
        </form>
      )}
    </div>
  );
}

function Close(props: { make: DeskItem[]; top3: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="cr-panel">
      <h2>{tx("closePick")}</h2>
      <p className="cr-muted">{props.top3.length} / 3</p>
      {props.make.slice(0, 12).map((item) => (
        <label className="cr-card" key={item.id}>
          <input checked={props.top3.includes(item.id)} onChange={() => props.onToggle(item.id)} type="checkbox" /> {item.title}
        </label>
      ))}
    </div>
  );
}

function Manifesto(props: { until: number | null; onClose: () => void; onStart: () => void }) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    if (!props.until) return;
    const tick = () => {
      const ms = Math.max(0, props.until! - Date.now());
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [props.until]);
  return (
    <div className="cr-panel" data-testid="certo-run-manifesto" role="dialog">
      {props.until ? <p className="cr-clock">{left}</p> : <p>{DEFAULT_MANIFESTO}</p>}
      <div className="cr-actions">
        {!props.until && <button className="do-button" onClick={props.onStart} type="button">{tx("startFocus")}</button>}
        <button onClick={props.onClose} type="button">{tx("closeFocus")}</button>
      </div>
    </div>
  );
}

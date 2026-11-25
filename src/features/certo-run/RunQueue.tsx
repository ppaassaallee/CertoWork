import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DeskItem } from "../../lib/certoRun/types";
import { RunDialog, RunTabs } from "./RunDialog";
import { runText as t, runDate } from "./runCopy";

export type QueueMode = "make" | "decide" | "owed" | "admin" | "delegated" | "unsorted";
export type RunForm = { id: string; kind: "delegate" | "date" | "drop" } | null;
export interface RunItemActions {
  busy: boolean;
  onDone: (id: string) => void; onNo: (id: string) => void; onMake: (id: string) => void;
  onDrop: (id: string) => void; onForm: (form: RunForm) => void; onPostpone: (id: string) => void;
}
const LABELS: Record<QueueMode, string> = { make: "Make", decide: "Decide", owed: "Owed to me", admin: "Admin batch", delegated: "Delegated", unsorted: "Not in a queue" };

function ItemMenu({ item, mode, actions, onOpen }: { item: DeskItem; mode: QueueMode; actions: RunItemActions; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  function show() {
    const rect = trigger.current!.getBoundingClientRect();
    const height = 270;
    setPosition({ left: Math.max(8, Math.min(rect.right - 210, window.innerWidth - 218)), top: rect.bottom + height > window.innerHeight ? Math.max(8, rect.top - height) : rect.bottom + 6 });
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false); };
    const track = (event: Event) => {
      if (menu.current?.contains(event.target as Node)) return;
      const rect = trigger.current!.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) { setOpen(false); return; }
      setPosition({ left: Math.max(8, Math.min(rect.right - 210, window.innerWidth - 218)), top: rect.bottom + 270 > window.innerHeight ? Math.max(8, rect.top - 270) : rect.bottom + 6 });
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", track, true); window.addEventListener("resize", track);
    return () => { document.removeEventListener("pointerdown", outside); window.removeEventListener("scroll", track, true); window.removeEventListener("resize", track); };
  }, [open]);
  const choices: [string, () => void][] = [["Open details", onOpen]];
  if (mode === "decide") choices.push(["No", () => actions.onNo(item.id)], ["Postpone →", () => actions.onPostpone(item.id)]);
  if (["unsorted", "owed", "admin"].includes(mode)) choices.push(["Move to Make", () => actions.onMake(item.id)]);
  if (["make", "delegated"].includes(mode)) choices.push(["Renegotiate", () => actions.onForm({ id: item.id, kind: "date" })]);
  choices.push(["Delegate", () => actions.onForm({ id: item.id, kind: "delegate" })], ["Drop", () => actions.onDrop(item.id)]);
  return <div ref={root} className="cr-item-menu"><button type="button" ref={trigger} className="cr-icon-button" disabled={actions.busy}
    aria-label={t("Actions for {title}", { title: item.title })} aria-haspopup="menu" aria-expanded={open} onClick={() => open ? setOpen(false) : show()}
    onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); show(); } }}>⋯</button>
    {open && createPortal(<div ref={menu} role="menu" aria-label={t("Item actions")} className="cr-action-popover" style={position} onKeyDown={event => {
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : event.key === "ArrowUp" ? (index - 1 + buttons.length) % buttons.length : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
      if (event.key === "Tab") { setOpen(false); trigger.current?.focus(); }
    }}>{choices.map(([label, action]) => <button role="menuitem" tabIndex={-1} type="button" key={label} onClick={() => {
      trigger.current?.focus(); setOpen(false); action();
    }}>{t(label)}</button>)}</div>, document.body)}
  </div>;
}

export function RunQueue({ mode, counts, items, actions, onMode, onOpen, onIntake }: {
  mode: QueueMode; counts: Record<QueueMode, number>; items: DeskItem[]; actions: RunItemActions;
  onMode: (mode: QueueMode) => void; onOpen: (id: string) => void; onIntake: () => void;
}) {
  useEffect(() => {
    if (mode !== "decide" || actions.busy || !items[0]) return;
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement)?.closest('input,textarea,select,button,[contenteditable=true],[role=menu],dialog')) return;
      const item = items[0];
      const action = ({ y: () => actions.onDone(item.id), n: () => actions.onNo(item.id), d: () => actions.onForm({ id: item.id, kind: "delegate" }), x: () => actions.onDrop(item.id), arrowright: () => actions.onPostpone(item.id) } as Record<string, () => void>)[event.key.toLowerCase()];
      if (action) { event.preventDefault(); action(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [mode, actions, items]);
  const modes = (Object.keys(LABELS) as QueueMode[]).filter(name => name !== "unsorted" || counts.unsorted > 0);
  return <div className="cr-queue-modern">
    <RunTabs label={t("Queues")} value={mode} onChange={onMode} className="cr-segbar" panelId="cr-queue-panel"
      options={modes.map(name => ({ value: name, label: `${t(LABELS[name])} ${counts[name]}` }))} />
    <section id="cr-queue-panel" role="tabpanel" aria-labelledby={`cr-queue-panel-tab-${mode}`}>
      <div className="cr-queue-heading"><div><span className="cr-kicker">{t("Your next commitments")}</span><h2>{t(LABELS[mode])}</h2></div>
        <span className="cr-muted">{mode === "make" ? t("{count} of 5 slots", { count: counts.make }) : t("{count} items", { count: counts[mode] })}</span></div>
      {mode === "make" && counts.make >= 5 && <p role="status" className="cr-flag">{t("Cap reached. Finish or delegate before adding more.")}</p>}
      {mode === "admin" && counts.admin > 15 && <p role="status" className="cr-flag">{t("Beyond 15 items. Hand the whole batch to someone else.")}</p>}
      {items.length === 0 ? <section className="cr-queue-empty"><span aria-hidden="true">✓</span><h3>{t("Nothing open in this queue.")}</h3><p>{t("Capture a commitment when you need it. Keep this space clear.")}</p><button type="button" className="cr-ghost" onClick={onIntake}>{t("Open Intake")}</button></section> :
        <ul className="cr-queue-list">{(mode === "decide" ? items.slice(0, 1) : items).map(item => <li className="cr-queue-row" key={item.id}>
          <span className={`cr-pri ${item.priority === "P1" ? "is-p1" : ""}`}>{item.priority}</span>
          <button type="button" className="cr-item-open" onClick={() => onOpen(item.id)}><strong>{item.title}</strong><span>{item.nextStep || item.deliverable || item.epic || t("Open details")}</span></button>
          <div className="cr-queue-meta">{item.clientEntity && <span>{item.clientEntity}</span>}{item.dueDate && <time dateTime={item.dueDate}>{runDate(item.dueDate)}</time>}</div>
          <button type="button" disabled={actions.busy} className="cr-row-primary" aria-label={t(mode === "decide" ? "Approve {title}" : "Complete {title}", { title: item.title })} onClick={() => actions.onDone(item.id)}>{t(mode === "decide" ? "Yes" : "Done")}</button>
          <ItemMenu item={item} mode={mode} actions={actions} onOpen={() => onOpen(item.id)} />
        </li>)}</ul>}
      {mode === "decide" && items.length > 0 && <p className="cr-queue-hint">{t("One decision at a time. Y yes · N no · D delegate · → postpone")}</p>}
    </section>
  </div>;
}

export function RunItemDrawer({ item, actions, form, onSave, onClose, error }: {
  item: DeskItem; actions: RunItemActions; form: RunForm; error?: string; onSave: (value: { who: string; date: string; context: string }) => void; onClose: () => void;
}) {
  const [who, setWho] = useState(""); const [date, setDate] = useState(""); const [context, setContext] = useState("");
  const editor = useRef<HTMLFormElement>(null);
  useEffect(() => { if (form?.id === item.id) editor.current?.querySelector<HTMLElement>("input,textarea")?.focus(); }, [form?.id, form?.kind, item.id]);
  return <RunDialog title={t("Item details")} kind="drawer" onClose={onClose} busy={actions.busy}>
    {error && <p role="alert" className="cr-flag">{error}</p>}
    <div className="cr-detail-meta"><span className={`cr-pri ${item.priority === "P1" ? "is-p1" : ""}`}>{item.priority}</span><span>{item.world}</span><span>{t(item.decision)}</span></div>
    <h1 className="cr-detail-title">{item.title}</h1>
    <dl className="cr-detail-properties"><div><dt>{t("Project / epic")}</dt><dd>{item.epic || "—"}</dd></div><div><dt>{t("Owner")}</dt><dd>{item.assigneeName || t("Unassigned")}</dd></div><div><dt>{t("Date")}</dt><dd>{item.dueDate ? runDate(item.dueDate) : t("No date")}</dd></div></dl>
    {([["Next step", item.nextStep], ["Deliverable", item.deliverable], ["Done when", item.doneWhen], ["Context", item.context], ["What I must do to unblock", item.unblock], ["Source", item.source]] as const).filter(([, value]) => value).map(([label, value]) => <section className="cr-detail-section" key={label}><h3>{t(label)}</h3><p>{value}</p></section>)}
    {form?.id !== item.id && <div className="cr-detail-actions"><button type="button" className="cr-solid" disabled={actions.busy} onClick={() => actions.onDone(item.id)}>{t(item.decision === "decide" ? "Yes" : "Mark complete")}</button><button type="button" className="cr-ghost" disabled={actions.busy} onClick={() => actions.onForm({ id: item.id, kind: "delegate" })}>{t("Delegate")}</button><button type="button" className="cr-ghost" disabled={actions.busy} onClick={() => actions.onForm({ id: item.id, kind: "date" })}>{t("Renegotiate")}</button><button type="button" className="cr-link" disabled={actions.busy} onClick={() => actions.onDrop(item.id)}>{t("Drop")}</button></div>}
    {form?.id === item.id && <form ref={editor} className="cr-detail-form" onSubmit={event => { event.preventDefault(); onSave({ who, date, context }); }}>
      <h3>{t(form.kind === "delegate" ? "Delegate" : form.kind === "date" ? "Renegotiate" : "Drop commitment")}</h3>
      {form.kind === "delegate" && <label>{t("Who")}<input autoComplete="off" value={who} onChange={event => setWho(event.target.value)} /></label>}
      {form.kind !== "drop" && <label>{t("Date")}<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>}
      <label>{t("Why it matters")}<textarea value={context} onChange={event => setContext(event.target.value)} /></label>
      <div className="cr-actions"><button type="submit" className="cr-solid" disabled={actions.busy}>{t(actions.busy ? "Saving…" : "Save")}</button><button type="button" className="cr-ghost" disabled={actions.busy} onClick={() => actions.onForm(null)}>{t("Cancel")}</button></div>
    </form>}
    <details className="cr-detail-record"><summary>{t("Record reference")}</summary><code>{item.externalId || item.id}</code></details>
  </RunDialog>;
}

import { useId, useMemo, useState } from "react";
import type { DeskItem } from "../../lib/certoRun/types";
import type { RunTab } from "./CertoRunDesk";
import { RunDialog } from "./RunDialog";
import { runText as t } from "./runCopy";

/** Searches only the already-authorized world snapshot. No network or AI calls. */
export function RunCommand({ items, tabs, onTab, onItem, onFilter, onClose }: {
  items: DeskItem[]; tabs: RunTab[]; onTab: (tab: RunTab) => void; onItem: (id: string) => void;
  onFilter: (query: string) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState(""); const [active, setActive] = useState(0);
  const id = useId();
  const { entries, more } = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const labels: Record<RunTab, string> = { today: "Today", queue: "Queue", projects: "Projects", team: "Team", week: "Week", intake: "Intake", close: "Close the day", life: "Life" };
    const commands = tabs.map(tab => ({ id: `tab-${tab}`, title: t(labels[tab]), detail: t("Navigate"), action: () => { onClose(); onTab(tab); } })).filter(entry => entry.title.toLocaleLowerCase().includes(needle));
    const matches = items.filter(item => item.state === "open" && `${item.title} ${item.epic} ${item.clientEntity || ""} ${item.nextStep || ""}`.toLocaleLowerCase().includes(needle));
    const results = matches.slice(0, 20).map(item => ({ id: item.id, title: item.title, detail: item.epic || t("Item"), action: () => { onClose(); onItem(item.id); } }));
    return { entries: [...commands, ...results], more: matches.length > 20 };
  }, [query, items, tabs, onTab, onItem, onFilter, onClose]);
  const index = Math.min(active, entries.length - 1);
  function step(next: number) {
    setActive(next);
    document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: "nearest" });
  }
  return <RunDialog title={t("Search and commands")} kind="command" onClose={onClose}>
    <input data-initial-focus role="combobox" aria-autocomplete="list" aria-expanded={entries.length > 0} aria-controls={entries.length ? `${id}-results` : undefined}
      aria-activedescendant={index >= 0 ? `${id}-option-${index}` : undefined} aria-label={t("Search items or navigate")}
      placeholder={t("Search items or navigate")} className="cr-command-input" value={query} onChange={event => { setQuery(event.target.value); setActive(0); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (["ArrowDown", "ArrowUp"].includes(event.key) && entries.length) { event.preventDefault(); step((index + (event.key === "ArrowDown" ? 1 : -1) + entries.length) % entries.length); }
        if (event.key === "Enter" && entries[index]) { event.preventDefault(); entries[index].action(); }
      }} />
    <div className="cr-command-results" id={`${id}-results`} role={entries.length ? "listbox" : undefined} aria-label={entries.length ? t("Search results") : undefined}>
      {entries.map((entry, i) => <div id={`${id}-option-${i}`} key={entry.id} role="option" aria-selected={index === i} className="cr-command-result"
        onMouseDown={event => event.preventDefault()} onMouseMove={() => setActive(i)} onClick={entry.action}><span>{entry.title}</span><small>{entry.detail}</small></div>)}
    </div>
    {entries.length === 0 && <p role="status" className="cr-command-empty">{t("No matching items or commands.")}</p>}
    {more && <p role="status" className="cr-command-empty">{t("Showing the first 20 items. Refine your search to find more.")}</p>}
    <footer className="cr-command-footer"><span>{t("↑ ↓ navigate · Enter open · Esc close")}</span>{query.trim() && <button type="button" className="cr-link" onClick={() => { onFilter(query); onTab("queue"); onClose(); }}>{t("Filter queue")}</button>}</footer>
  </RunDialog>;
}

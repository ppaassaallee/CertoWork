import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AlertCircle, Bookmark, Bug, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, CornerDownRight, Gem, Inbox, Layers, Maximize2, Minimize2, Plus, Target, User } from "./ui/Icon";
import { memberName } from "./ProjectControls";
import { retainFocusForOpen } from "../lib/openWorkItem";
import { t } from "../lib/i18n";
import { useLocale } from "../lib/useLocale";
import { workItemTypeLabel } from "../lib/workItemTypeLabels";
import { workStatusLabel } from "../lib/workStatuses";
import { buildTimelineEntries, timelineDate, timelineGeometry, timelineMonths, timelinePosition, timelineRange, timelineSections, timelineToday, type TimelineEntry, type TimelineGrouping, type TimelineItem, type TimelineScale } from "../lib/projectTimeline";
import "./ProjectTimeline.css";

type Member = { id: string; userId?: string; alias?: string; displayName?: string; email?: string; status?: string };
const typeIcons = { epic: Gem, feature: Layers, story: Bookmark, pbi: Target, task: CheckSquare, subtask: CornerDownRight, bug: Bug, ticket: Inbox, issue: AlertCircle };
const closed = new Set(["done", "completed", "closed", "archived", "cancelled", "canceled"]);

function initials(label: string) {
  return label.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
function avatarColor(label: string) {
  let hash = 0;
  for (const letter of label) hash = ((hash << 5) - hash + letter.charCodeAt(0)) | 0;
  return Math.abs(hash) % 5;
}

function TimelineChoice<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return <div className="cw-timeline-choice" ref={root}>
    <button ref={trigger} aria-label={`${label}: ${options.find((option) => option.value === value)?.label}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)} type="button">{options.find((option) => option.value === value)?.label}<ChevronDown size={12} /></button>
    {open && <div className="cw-timeline-choice-menu" role="menu" aria-label={label} onKeyDown={(event) => {
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus(); }
      if (event.key === "Home" || event.key === "End") { event.preventDefault(); buttons[event.key === "Home" ? 0 : buttons.length - 1]?.focus(); }
      if (event.key === "Tab") setOpen(false);
    }}>{options.map((option) => <button role="menuitemradio" aria-checked={option.value === value} onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus(); }} type="button" key={option.value}>{option.label}</button>)}</div>}
  </div>;
}

export function ProjectTimeline({ items, members = [], selectedItemId, projectMode, sectionOrder = [], scale, onScaleChange, focused, onFocusChange, onOpenItem, onAddItem }: {
  selectedItemId?: string | null;
  items: TimelineItem[];
  members?: Member[];
  projectMode: boolean;
  sectionOrder?: string[];
  scale: TimelineScale;
  onScaleChange: (scale: TimelineScale) => void;
  focused: boolean;
  onFocusChange: (focused: boolean) => void;
  onOpenItem: (id: string) => void;
  onAddItem: () => void;
}) {
  const locale = useLocale();
  const dateLocale = { en: "en-US", es: "es-GT" }[locale];
  const entries = useMemo(() => buildTimelineEntries(items), [items]);
  const today = timelineToday();
  const range = useMemo(() => timelineRange(entries, today), [entries, today]);
  const [grouping, setGrouping] = useState<TimelineGrouping>(projectMode ? "hierarchy" : "project");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(() => new Set());
  const [fit, setFit] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(900);
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusDay = useRef<number | null>(null);
  const sections = useMemo(() => timelineSections(entries, grouping, t("timeline.standalone"), sectionOrder), [entries, grouping, sectionOrder, locale]);
  const memberById = useMemo(() => {
    const map = new Map<string, Member>();
    for (const member of members) { map.set(member.id, member); if (member.userId) map.set(member.userId, member); }
    return map;
  }, [members]);
  const railWidth = viewportWidth < 650 ? 200 : 244;
  const { dayWidth, tickStep } = timelineGeometry(range.days, Math.max(1, viewportWidth - railWidth), scale, fit);
  const canvasWidth = Math.max(viewportWidth - railWidth, range.days * dayWidth);
  const months = useMemo(() => timelineMonths(range.start, range.end), [range.start, range.end]);
  const ticks = useMemo(() => Array.from({ length: Math.ceil(range.days / tickStep) }, (_, i) => range.start + i * tickStep), [range.start, range.days, tickStep]);
  const scheduled = entries.filter((entry) => entry.start !== null);
  const undated = entries.filter((entry) => entry.start === null);
  const formatDay = (day: number) => timelineDate(day).toLocaleDateString(dateLocale, { timeZone: "UTC", month: "short", day: "numeric" });
  const dateCaption = (entry: TimelineEntry) => {
    if (entry.start === null || entry.end === null) return t("timeline.noDate");
    if (entry.start !== entry.end) return `${formatDay(entry.start)} – ${formatDay(entry.end)}`;
    if (entry.startOnly) return `${t("timeline.starts")} ${formatDay(entry.start)}`;
    return entry.start === today ? t("timeline.dueToday") : `${t("timeline.due")} ${formatDay(entry.end)}`;
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewportWidth(element.clientWidth));
    observer.observe(element);
    setViewportWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);
  const scrollToDay = (day: number, behavior: ScrollBehavior = "smooth") => {
    focusDay.current = day;
    const element = scrollRef.current;
    if (element) element.scrollTo({ left: Math.max(0, (day - range.start) * dayWidth - (element.clientWidth - railWidth) / 3), behavior });
  };
  useEffect(() => {
    const nearToday = entries.some((entry) => entry.start !== null && entry.end !== null && entry.start <= today + 28 && entry.end >= today - 7);
    const first = entries.reduce((min, entry) => entry.start === null ? min : Math.min(min, entry.start), Infinity);
    focusDay.current = nearToday || !Number.isFinite(first) ? today : first;
    scrollToDay(focusDay.current, "auto");
  }, [range.start, range.end]);
  useEffect(() => { scrollToDay(focusDay.current ?? today, "auto"); }, [dayWidth]);

  const toggle = (key: string) => setCollapsed((current) => {
    const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next;
  });
  const toggleItem = (key: string) => setCollapsedItems((current) => {
    const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next;
  });
  const assigneeLabels = (entry: TimelineEntry) => {
    const ids = [...new Set([...(entry.assigneeIds || []), entry.assigneeId || ""].filter(Boolean))];
    const names = ids.map((id) => memberById.get(id)).filter((member): member is Member => Boolean(member)).map(memberName);
    if (names.length) return [...new Set(names)];
    return [...new Set([...(entry.assignees || []), entry.owner || entry.assignee || ""].filter((name) => name && !name.includes("@")))];
  };
  const avatar = (entry: TimelineEntry) => {
    const labels = assigneeLabels(entry);
    const name = labels[0];
    return <span className={`cw-timeline-avatar tone-${name ? avatarColor(name) : "empty"}`} title={labels.join(", ") || t("timeline.unassigned")} aria-label={labels.join(", ") || t("timeline.unassigned")}>{name ? initials(name) : <User size={12} />}{labels.length > 1 && <sup>+{labels.length - 1}</sup>}</span>;
  };
  const icon = (entry: TimelineEntry) => {
    const Icon = typeIcons[entry.kind as keyof typeof typeIcons] || Target;
    return <span className={`cw-timeline-kind is-${entry.kind}`} title={workItemTypeLabel(entry.kind)}><Icon size={14} /></span>;
  };
  const renderEntry = (entry: TimelineEntry, byId: Map<string, TimelineEntry>) => {
    let current = entry;
    let depth = 0;
    while (current.parentId && byId.has(current.parentId)) {
      if (collapsedItems.has(current.parentId)) return null;
      depth++;
      current = byId.get(current.parentId)!;
    }
    const position = timelinePosition(entry, range.start, dayWidth);
    if (!position) return null;
    const complete = closed.has(entry.status);
    const overdue = !complete && entry.end! < today;
    const tone = complete ? "done" : entry.status === "blocked" ? "blocked" : overdue ? "overdue" : "active";
    const point = entry.start === entry.end;
    const inside = !point && position.width >= 180;
    const caption = dateCaption(entry);
    return <div className={`cw-timeline-row is-${tone}${entry.rollup ? " is-rollup" : ""}${entry.id === selectedItemId ? " is-selected" : ""}`} data-testid="timeline-item" data-item-id={entry.id} data-depth={depth} key={entry.id}>
      <div className="cw-timeline-rail cw-timeline-item-name" style={{ "--timeline-depth": Math.min(depth, 6) } as CSSProperties}>
        {entry.children.length ? <button className="cw-timeline-expand" aria-label={`${collapsedItems.has(entry.id) ? t("timeline.expand") : t("timeline.collapse")} ${entry.title}`} aria-expanded={!collapsedItems.has(entry.id)} onClick={() => toggleItem(entry.id)} type="button"><ChevronDown size={13} className={collapsedItems.has(entry.id) ? "is-collapsed" : ""} /></button> : <span className="cw-timeline-expand-space" />}
        {icon(entry)}
        <button className="cw-timeline-title" onClick={() => onOpenItem(entry.id)} onMouseDown={retainFocusForOpen} title={entry.title} type="button">{entry.title}</button>
      </div>
      <div className="cw-timeline-track">
        <button className={`cw-timeline-event${point ? " is-point" : ""}${inside ? " is-inside" : ""}`} onClick={() => onOpenItem(entry.id)} onMouseDown={retainFocusForOpen} style={{ left: position.left, "--event-width": `${position.width}px` } as CSSProperties} title={`${entry.title}\n${caption}${entry.rollup ? `\n${t("timeline.rollup")}` : ""}`} type="button">
          <span className="cw-timeline-duration" aria-hidden="true" />
          <span className="cw-timeline-event-label">{avatar(entry)}<span><strong>{entry.title}</strong><small>{caption}{entry.rollup ? ` · ${t("timeline.summary")}` : ""}</small></span></span>
        </button>
        <span className="cw-timeline-today-line" aria-hidden="true" style={{ left: (today - range.start + 0.5) * dayWidth }} />
      </div>
    </div>;
  };
  return <section className={`do-gantt cw-project-timeline${dayWidth < 4 ? " is-overview-scale" : ""}`} data-testid="work-items-gantt" aria-label={t("timeline.title")} style={{ "--timeline-rail-width": `${railWidth}px` } as CSSProperties}>
    <div className="cw-timeline-toolbar">
      <button className="cw-timeline-add" onClick={onAddItem} type="button"><Plus size={14} />{t("timeline.add")}</button>
      <div className="cw-timeline-navigation"><button aria-label={t("timeline.previous")} onClick={() => scrollRef.current?.scrollBy({ left: -Math.max(280, viewportWidth - railWidth), behavior: "smooth" })} type="button"><ChevronLeft size={16} /></button><button onClick={() => scrollToDay(today)} type="button">{t("timeline.today")}</button><button aria-label={t("timeline.next")} onClick={() => scrollRef.current?.scrollBy({ left: Math.max(280, viewportWidth - railWidth), behavior: "smooth" })} type="button"><ChevronRight size={16} /></button></div>
      <span className="cw-timeline-scheduled-count">{scheduled.length} {t("timeline.scheduled")}</span>
      <span className="cw-timeline-toolbar-spacer" />
      <div className="cw-timeline-group-label">{t("views.group")}<TimelineChoice label={t("timeline.groupBy")} value={grouping} onChange={setGrouping} options={[{ value: "hierarchy", label: t("timeline.hierarchy") }, { value: "project", label: t("navProjects") }, { value: "status", label: t("timeline.status") }, { value: "none", label: t("timeline.noGroups") }]} /></div>
      <TimelineChoice label={t("timeline.scale")} value={scale} onChange={(next) => { setFit(false); onScaleChange(next); }} options={[{ value: "day", label: t("timeline.days") }, { value: "week", label: t("timeline.weeks") }, { value: "month", label: t("timeline.months") }, { value: "quarter", label: t("timeline.quarters") }]} />
      <button className={fit ? "is-active" : ""} aria-pressed={fit} onClick={() => setFit((current) => !current)} type="button">{t("gantt.fit")}</button>
      <button aria-label={focused ? t("timeline.exitFocus") : t("timeline.focus")} title={focused ? t("timeline.exitFocus") : t("timeline.focus")} onClick={() => onFocusChange(!focused)} type="button">{focused ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
    </div>
    <div className="cw-timeline-scroll" ref={scrollRef} data-testid="timeline-scroll" onScroll={(event) => { focusDay.current = range.start + (event.currentTarget.scrollLeft + (event.currentTarget.clientWidth - railWidth) / 3) / dayWidth; }}>
      <div className="cw-timeline-canvas" style={{ width: canvasWidth + railWidth, "--timeline-day-width": `${dayWidth}px`, "--timeline-week-width": `${dayWidth * (dayWidth < 4 ? tickStep : 7)}px` } as CSSProperties}>
        <div className="cw-timeline-axis">
          <div className="cw-timeline-rail cw-timeline-axis-label"><strong>{t("timeline.title")}</strong><span>{t("timeline.items")}</span></div>
          <div className="cw-timeline-calendar-head">
            <div className="cw-timeline-months">{months.map((month) => <span key={month.start} style={{ left: (month.start - range.start) * dayWidth, width: month.days * dayWidth }}>{month.unit === "month" ? month.date.toLocaleDateString(dateLocale, { timeZone: "UTC", month: "long", year: "numeric" }) : month.unit === "year" ? month.date.getUTCFullYear() : `${month.date.getUTCFullYear()} – ${timelineDate(month.start + month.days - 1).getUTCFullYear()}`}</span>)}</div>
            <div className="cw-timeline-ticks">{ticks.map((day) => <span key={day} style={{ left: (day - range.start) * dayWidth, width: Math.min(tickStep, range.end - day + 1) * dayWidth }}>{tickStep === 1 ? timelineDate(day).toLocaleDateString(dateLocale, { timeZone: "UTC", weekday: "short", day: "numeric" }) : `${formatDay(day)} – ${timelineDate(Math.min(day + tickStep - 1, range.end)).getUTCDate()}`}</span>)}</div>
            <span className="cw-timeline-today-marker" title={t("timeline.today")} style={{ left: (today - range.start + 0.5) * dayWidth }} />
          </div>
        </div>
        {sections.map((section) => {
          const dated = section.entries.filter((entry) => entry.start !== null);
          if (!dated.length) return null;
          const key = `${grouping}:${section.id}`;
          const isCollapsed = collapsed.has(key);
          const groupStart = Math.min(...dated.map((entry) => entry.start!));
          const groupEnd = Math.max(...dated.map((entry) => entry.end!));
          const sectionById = new Map(section.entries.map((entry) => [entry.id, entry]));
          return <Fragment key={key}>
            {section.label && <div className="cw-timeline-group" data-testid={grouping === "project" ? "gantt-project-section" : "timeline-group"}>
              <button className="cw-timeline-rail" aria-expanded={!isCollapsed} onClick={() => toggle(key)} type="button"><ChevronDown className={isCollapsed ? "is-collapsed" : ""} size={14} /><strong title={section.label}>{grouping === "status" ? workStatusLabel(section.label) : section.label}</strong><span>{dated.length}</span></button>
              <div className="cw-timeline-track"><span className="cw-timeline-group-span" style={{ left: (groupStart - range.start) * dayWidth, width: (groupEnd - groupStart + 1) * dayWidth }} /><span className="cw-timeline-today-line" aria-hidden="true" style={{ left: (today - range.start + 0.5) * dayWidth }} /></div>
            </div>}
            {!isCollapsed && dated.map((entry) => renderEntry(entry, sectionById))}
          </Fragment>;
        })}
        {scheduled.length === 0 && <div className="cw-timeline-empty"><strong>{t("timeline.empty")}</strong><span>{t("timeline.emptyHint")}</span></div>}
        {undated.length > 0 && <div className="cw-timeline-undated">
          <button className="cw-timeline-undated-heading" aria-expanded={!collapsed.has("undated")} onClick={() => toggle("undated")} type="button"><ChevronDown className={collapsed.has("undated") ? "is-collapsed" : ""} size={14} /><strong>{t("timeline.noDate")}</strong><span>{undated.length}</span></button>
          {!collapsed.has("undated") && undated.map((entry) => <button className="cw-timeline-undated-item" data-depth={entry.depth} style={{ "--timeline-depth": Math.min(entry.depth, 6) } as CSSProperties} onClick={() => onOpenItem(entry.id)} onMouseDown={retainFocusForOpen} key={entry.id} type="button">{icon(entry)}<strong>{entry.title}</strong>{avatar(entry)}<span>{t("timeline.setDates")}</span></button>)}
        </div>}
      </div>
    </div>
  </section>;
}

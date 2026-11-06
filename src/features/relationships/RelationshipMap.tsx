import { useEffect, useMemo, useRef, useState } from "react";
import { allowedChildKinds, hierarchyKind, type HierarchyKind } from "../../lib/itemHierarchy";
import {
  buildRelationshipRoots,
  buildRelationshipTree,
  relationshipBranchIds,
  relationshipNodeCount,
  type RelationshipLens,
  type RelationshipRecord,
  type RelationshipRoot,
  type RelationshipTreeNode,
} from "../../lib/relationshipMap";
import { getLocale } from "../../lib/i18n";
import { workItemTypeLabel } from "../../lib/workItemTypeLabels";
import { createWorkspaceStakeholder, listWorkspaceStakeholders } from "../../lib/stakeholders/storage";
import { NativeSelect } from "../../components/ui/NativeSelect";
import {
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  FolderKanban,
  GitBranch,
  Layers3,
  Loader2,
  Network,
  Plus,
  Search,
  User,
  Users,
  X,
} from "../../components/ui/Icon";

type CreateItemInput = {
  projectId: string;
  title: string;
  kind: HierarchyKind;
  parent: RelationshipRecord | null;
  root: RelationshipRoot;
};

type Props = {
  projects: RelationshipRecord[];
  tasks: RelationshipRecord[];
  userId: string;
  workspaceId: string;
  canManageStakeholders: boolean;
  onCreateItem(input: CreateItemInput): Promise<string | void>;
  onCreateProject(name: string, root: RelationshipRoot): Promise<string | void>;
  onOpenItem(id: string): void;
  onOpenProject(project: RelationshipRecord): void;
  onNotice(message: string): void;
};

const LENSES: Array<{ id: RelationshipLens; en: string; es: string; icon: typeof Users }> = [
  { id: "client", en: "Clients", es: "Clientes", icon: Briefcase },
  { id: "delivery", en: "Delivery entities", es: "Entidades de entrega", icon: Briefcase },
  { id: "people", en: "People & stakeholders", es: "Personas y stakeholders", icon: Users },
  { id: "project", en: "Projects", es: "Proyectos", icon: FolderKanban },
];

function entityTitle(record: RelationshipRecord) {
  return String(record?.title || record?.name || "Untitled").trim();
}

function nodeStatus(record: RelationshipRecord) {
  const status = String(record?.status || record?.state || "open").toLowerCase();
  return status === "done" || status === "completed" || status === "closed" ? "done" : status;
}

function NodeIcon({ kind }: { kind: RelationshipTreeNode["kind"] }) {
  if (kind === "project") return <FolderKanban size={15} />;
  if (kind === "epic") return <Layers3 size={15} />;
  if (kind === "feature") return <GitBranch size={15} />;
  return <CircleDot size={15} />;
}

function lensLabel(lens: RelationshipLens, locale: "en" | "es") {
  const match = LENSES.find((item) => item.id === lens);
  return locale === "es" ? match?.es : match?.en;
}

export function RelationshipMap({
  projects,
  tasks,
  userId,
  workspaceId,
  canManageStakeholders,
  onCreateItem,
  onCreateProject,
  onOpenItem,
  onOpenProject,
  onNotice,
}: Props) {
  const locale = getLocale() === "es" ? "es" : "en";
  const tx = (en: string, es: string) => (locale === "es" ? es : en);
  const [lens, setLens] = useState<RelationshipLens>("client");
  const [stakeholders, setStakeholders] = useState<RelationshipRecord[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [selectedRootId, setSelectedRootId] = useState("");
  const [queryText, setQueryText] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createTarget, setCreateTarget] = useState<{
    node: RelationshipTreeNode | null;
    root: RelationshipRoot;
    kind: HierarchyKind | "project";
  } | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personRole, setPersonRole] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  useEffect(() => {
    let active = true;
    if (!workspaceId || lens !== "people") return;
    setLoadingPeople(true);
    void listWorkspaceStakeholders(workspaceId)
      .then((records) => {
        if (!active) return;
        setStakeholders(records);
      })
      .catch(() => {
        if (active) onNotice(locale === "es" ? "No se pudieron actualizar las personas." : "People could not be refreshed.");
      })
      .finally(() => {
        if (active) setLoadingPeople(false);
      });
    return () => {
      active = false;
    };
  }, [lens, locale, onNotice, workspaceId]);

  const roots = useMemo(
    () => buildRelationshipRoots({ lens, projects, tasks, stakeholders }),
    [lens, projects, stakeholders, tasks],
  );
  const filteredRoots = useMemo(() => {
    const needle = queryText.trim().toLocaleLowerCase();
    if (!needle) return roots;
    return roots.filter((root) => `${root.label} ${root.meta || ""}`.toLocaleLowerCase().includes(needle));
  }, [queryText, roots]);

  useEffect(() => {
    if (filteredRoots.some((root) => root.id === selectedRootId)) return;
    setSelectedRootId(filteredRoots[0]?.id || "");
  }, [filteredRoots, selectedRootId]);

  const selectedRoot = roots.find((root) => root.id === selectedRootId) || filteredRoots[0] || null;
  const tree = useMemo(
    () => (selectedRoot ? buildRelationshipTree({ root: selectedRoot, projects, tasks }) : []),
    [projects, selectedRoot, tasks],
  );
  const displayTree = useMemo(
    () => selectedRoot?.lens === "project" && tree[0]?.kind === "project" ? tree[0].children : tree,
    [selectedRoot?.lens, tree],
  );
  const branchIds = useMemo(() => relationshipBranchIds(displayTree), [displayTree]);

  useEffect(() => {
    if (!selectedRoot) return;
    setExpanded(new Set(displayTree.filter((node) => node.kind === "project").map((node) => node.id)));
  }, [selectedRoot?.id]);

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = (node: RelationshipTreeNode | null, root: RelationshipRoot) => {
    const kinds = node
      ? node.kind === "project"
        ? (["epic", "pbi"] as HierarchyKind[])
        : allowedChildKinds(hierarchyKind(node.record))
      : [];
    setCreateTitle("");
    setCreateTarget({ node, root, kind: node ? kinds[0] || "pbi" : root.lens === "people" ? "pbi" : "project" });
  };

  const submitCreate = async () => {
    if (!createTarget || !createTitle.trim()) return;
    setCreating(true);
    try {
      const id = createTarget.kind === "project"
        ? await onCreateProject(createTitle.trim(), createTarget.root)
        : await onCreateItem({
            projectId:
              createTarget.node?.kind === "project"
                ? String(createTarget.node.record.id)
                : String(createTarget.node?.record.projectId || ""),
            title: createTitle.trim(),
            kind: createTarget.kind,
            parent: createTarget.node?.kind === "project" ? null : createTarget.node?.record || null,
            root: createTarget.root,
          });
      if (id && createTarget.node) setExpanded((current) => new Set(current).add(createTarget.node!.id));
      setCreateTarget(null);
      setCreateTitle("");
    } finally {
      setCreating(false);
    }
  };

  const createPerson = async () => {
    if (!personName.trim() || !userId || !workspaceId) return;
    setCreating(true);
    try {
      const created = await createWorkspaceStakeholder({ userId, workspaceId, name: personName, email: personEmail, role: personRole });
      setStakeholders((current) => [...current, created]);
      setSelectedRootId(created.id);
      setPersonName("");
      setPersonEmail("");
      setPersonRole("");
      setAddingPerson(false);
      onNotice(tx("Person added.", "Persona agregada."));
    } finally {
      setCreating(false);
    }
  };

  const renderNode = (node: RelationshipTreeNode, depth: number) => {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id);
    const childKinds = node.kind === "project" ? ["epic", "pbi"] : allowedChildKinds(hierarchyKind(node.record));
    const status = nodeStatus(node.record);
    return (
      <div className="cw-map-branch" data-depth={depth} key={`${node.kind}:${node.id}`}>
        <div className={`cw-map-node is-${node.kind} ${status === "done" ? "is-done" : ""}`}>
          <button
            aria-label={hasChildren ? (isOpen ? tx("Collapse", "Contraer") : tx("Expand", "Expandir")) : undefined}
            className="cw-map-toggle"
            disabled={!hasChildren}
            onClick={() => hasChildren && toggle(node.id)}
            type="button"
          >
            {hasChildren ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span />}
          </button>
          <button
            className="cw-map-node-main"
            onClick={() => node.kind === "project" ? onOpenProject(node.record) : onOpenItem(node.id)}
            type="button"
          >
            <span className="cw-map-node-icon"><NodeIcon kind={node.kind} /></span>
            <span className="cw-map-node-copy">
              <small>{node.kind === "project" ? tx("Project", "Proyecto") : workItemTypeLabel(node.kind, locale)}</small>
              <strong>{entityTitle(node.record)}</strong>
            </span>
          </button>
          {status === "done" ? <CheckCircle2 className="cw-map-done" size={15} /> : null}
          {childKinds.length ? (
            <button
              aria-label={tx("Add child", "Agregar hijo")}
              className="cw-map-add"
              onClick={() => openCreate(node, selectedRoot!)}
              title={tx("Add the next level", "Agregar el siguiente nivel")}
              type="button"
            >
              <Plus size={14} />
            </button>
          ) : null}
        </div>
        {hasChildren && isOpen ? <div className="cw-map-children">{node.children.map((child) => renderNode(child, depth + 1))}</div> : null}
      </div>
    );
  };

  return (
    <section className="cw-relationships" data-testid="relationships-map">
      <header className="cw-relationships-header">
        <div>
          <span className="cw-eyebrow"><Network size={14} /> {tx("Relationship map", "Mapa de relaciones")}</span>
          <h1>{tx("See how work connects", "Visualiza cómo se conecta el trabajo")}</h1>
          <p>{tx("Move from an entity to the exact project, Epic, Feature, PBI or Sub Task behind it.", "Pasa de una entidad al proyecto, Épica, Feature, PBI o Sub Task exacto que la respalda.")}</p>
        </div>
        <div className="cw-map-summary">
          <strong>{selectedRoot ? relationshipNodeCount(tree) : 0}</strong>
          <span>{tx("connected records", "registros conectados")}</span>
        </div>
      </header>

      <div className="cw-map-lenses" role="tablist" aria-label={tx("Map by", "Mapear por")}>
        {LENSES.map((item) => {
          const Icon = item.icon;
          return (
            <button
              aria-selected={lens === item.id}
              className={lens === item.id ? "is-active" : ""}
              key={item.id}
              onClick={() => { setLens(item.id); setQueryText(""); setSelectedRootId(""); }}
              role="tab"
              type="button"
            >
              <Icon size={15} /> {locale === "es" ? item.es : item.en}
            </button>
          );
        })}
      </div>

      <div className="cw-map-workspace">
        <aside className="cw-map-directory">
          <div className="cw-map-directory-head">
            <div>
              <small>{tx("Explore by", "Explorar por")}</small>
              <strong>{lensLabel(lens, locale)}</strong>
            </div>
            {lens === "people" && canManageStakeholders ? (
              <button aria-label={tx("Add stakeholder tag", "Agregar tag de stakeholder")} onClick={() => setAddingPerson(true)} type="button"><Plus size={15} /></button>
            ) : null}
          </div>
          <label className="cw-map-search">
            <Search size={14} />
            <input onChange={(event) => setQueryText(event.target.value)} placeholder={tx("Find an entity…", "Buscar una entidad…")} value={queryText} />
          </label>
          {addingPerson ? (
            <div className="cw-map-inline-create">
              <input autoFocus onChange={(event) => setPersonName(event.target.value)} placeholder={tx("Stakeholder tag name", "Nombre del tag de stakeholder")} value={personName} />
              <input onChange={(event) => setPersonEmail(event.target.value)} placeholder={tx("Reference email (optional)", "Correo de referencia (opcional)")} type="email" value={personEmail} />
              <input onChange={(event) => setPersonRole(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createPerson(); }} placeholder={tx("Role or relationship", "Rol o relación")} value={personRole} />
              <button disabled={creating || !personName.trim()} onClick={() => void createPerson()} type="button">{creating ? <Loader2 className="spin" size={14} /> : <Plus size={14} />}</button>
              <button onClick={() => setAddingPerson(false)} type="button"><X size={14} /></button>
            </div>
          ) : null}
          <div className="cw-map-root-list">
            {loadingPeople ? <div className="cw-map-empty"><Loader2 className="spin" size={18} /></div> : null}
            {!loadingPeople && filteredRoots.map((root) => (
              <button className={root.id === selectedRoot?.id ? "is-active" : ""} key={root.id} onClick={() => setSelectedRootId(root.id)} type="button">
              <span className="cw-map-root-avatar">{lens === "people" ? <User size={15} /> : lens === "project" ? <FolderKanban size={15} /> : <Briefcase size={15} />}</span>
                <span><strong>{root.label}</strong><small>{root.projectIds.length} {root.projectIds.length === 1 ? tx("project", "proyecto") : tx("projects", "proyectos")} · {root.itemIds.length} {tx("items", "ítems")}</small></span>
                <ChevronRight size={14} />
              </button>
            ))}
            {!loadingPeople && filteredRoots.length === 0 ? <div className="cw-map-empty"><Network size={22} /><strong>{tx("No relationships yet", "Aún no hay relaciones")}</strong><span>{tx("Assign this entity on a project or item and it will appear here.", "Asigna esta entidad a un proyecto o ítem y aparecerá aquí.")}</span></div> : null}
          </div>
        </aside>

        <div className="cw-map-canvas">
          {selectedRoot ? (
            <>
              <div className="cw-map-toolbar">
                <div><span>{tx("Viewing", "Viendo")}</span><strong>{selectedRoot.label}</strong></div>
                <div>
                  {lens !== "project" ? <button onClick={() => openCreate(null, selectedRoot)} type="button"><Plus size={14} /> {lens === "people" ? tx("Related item", "Ítem relacionado") : tx("Project", "Proyecto")}</button> : null}
                  <button onClick={() => setExpanded(new Set(branchIds))} type="button">{tx("Expand all", "Expandir todo")}</button>
                  <button onClick={() => setExpanded(new Set())} type="button">{tx("Collapse all", "Contraer todo")}</button>
                  <button onClick={() => canvasRef.current?.scrollTo({ top: 0, left: 0, behavior: "smooth" })} type="button">{tx("Back to start", "Volver al inicio")}</button>
                </div>
              </div>
              <div className="cw-map-scroll" ref={canvasRef} tabIndex={0} role="region"
                aria-label={tx("Mind map canvas. Scroll in any direction or drag the background.", "Lienzo del mapa mental. Desplázate en cualquier dirección o arrastra el fondo.")}
                onPointerDown={(event) => {
                  if (event.pointerType !== "mouse" || event.button !== 0 || (event.target as HTMLElement).closest("button,input,a,select")) return;
                  pan.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
                  event.currentTarget.setPointerCapture(event.pointerId);
                  event.currentTarget.classList.add("is-panning");
                }}
                onPointerMove={(event) => {
                  if (!pan.current) return;
                  event.currentTarget.scrollLeft = pan.current.left - (event.clientX - pan.current.x);
                  event.currentTarget.scrollTop = pan.current.top - (event.clientY - pan.current.y);
                }}
                onPointerUp={(event) => { pan.current = null; event.currentTarget.classList.remove("is-panning"); }}
                onLostPointerCapture={(event) => { pan.current = null; event.currentTarget.classList.remove("is-panning"); }}
              >
                <div className="cw-map-scene">
                <div className="cw-map-root-node">
                  <span>{lens === "people" ? <User size={18} /> : lens === "project" ? <FolderKanban size={18} /> : <Briefcase size={18} />}</span>
                  <div><small>{lensLabel(lens, locale)}</small><strong>{selectedRoot.label}</strong>{selectedRoot.meta ? <em>{selectedRoot.meta}</em> : null}{lens === "people" ? <em>{tx("Stakeholder tag · not a Certo user", "Tag de stakeholder · no es usuario de Certo")}</em> : null}</div>
                  {lens === "project" && tree[0] ? <button aria-label={tx("Add item", "Agregar ítem")} onClick={() => openCreate(tree[0], selectedRoot)} type="button"><Plus size={15} /></button> : lens !== "project" ? <button aria-label={lens === "people" ? tx("Add related item", "Agregar ítem relacionado") : tx("Add project", "Agregar proyecto")} onClick={() => openCreate(null, selectedRoot)} type="button"><Plus size={15} /></button> : null}
                </div>
                <div className="cw-map-trunk">{displayTree.map((node) => renderNode(node, 0))}</div>
                {displayTree.length === 0 ? <div className="cw-map-canvas-empty"><Network size={28} /><strong>{tx("This entity is ready to connect", "Esta entidad está lista para conectarse")}</strong><p>{lens === "people" ? tx("Add the first item requested by or related to this stakeholder tag.", "Agrega el primer ítem solicitado por o relacionado con este tag de stakeholder.") : lens === "project" ? tx("Add the first Epic or PBI.", "Agrega la primera Épica o PBI.") : tx("Add its first project to begin the map.", "Agrega su primer proyecto para comenzar el mapa.")}</p>{lens === "project" && tree[0] ? <button onClick={() => openCreate(tree[0], selectedRoot)} type="button"><Plus size={14} /> {tx("Add item", "Agregar ítem")}</button> : lens !== "project" ? <button onClick={() => openCreate(null, selectedRoot)} type="button"><Plus size={14} /> {lens === "people" ? tx("Add related item", "Agregar ítem relacionado") : tx("Add project", "Agregar proyecto")}</button> : null}</div> : null}
                </div>
              </div>
            </>
          ) : <div className="cw-map-canvas-empty"><Network size={30} /><strong>{tx("Choose an entity to start", "Elige una entidad para comenzar")}</strong></div>}
        </div>
      </div>

      {createTarget ? (
        <div className="cw-map-create-popover" role="dialog" aria-modal="true">
          <button aria-label={tx("Close", "Cerrar")} className="cw-map-create-scrim" onClick={() => setCreateTarget(null)} type="button" />
          <form onSubmit={(event) => { event.preventDefault(); void submitCreate(); }}>
            <div className="cw-map-create-head"><div><small>{tx("Quick create", "Creación rápida")}</small><strong>{createTarget.node ? entityTitle(createTarget.node.record) : createTarget.root.label}</strong></div><button onClick={() => setCreateTarget(null)} type="button"><X size={16} /></button></div>
            {createTarget.node ? (
              <label><span>{tx("Type", "Tipo")}</span><NativeSelect onChange={(event) => setCreateTarget((current) => current ? { ...current, kind: event.target.value as HierarchyKind } : current)} value={createTarget.kind}>{(createTarget.node.kind === "project" ? ["epic", "pbi"] : allowedChildKinds(hierarchyKind(createTarget.node.record))).map((kind) => <option key={kind} value={kind}>{workItemTypeLabel(kind, locale)}</option>)}</NativeSelect></label>
            ) : null}
            <label><span>{createTarget.kind === "project" ? tx("Project name", "Nombre del proyecto") : createTarget.root.lens === "people" && !createTarget.node ? tx("Related item", "Ítem relacionado") : tx("Item title", "Título del ítem")}</span><input autoFocus onChange={(event) => setCreateTitle(event.target.value)} placeholder={tx("What needs to exist?", "¿Qué debe existir?")} value={createTitle} /></label>
            <footer><button onClick={() => setCreateTarget(null)} type="button">{tx("Cancel", "Cancelar")}</button><button className="is-primary" disabled={creating || !createTitle.trim()} type="submit">{creating ? <Loader2 className="spin" size={14} /> : <Plus size={14} />}{tx("Create", "Crear")}</button></footer>
          </form>
        </div>
      ) : null}
    </section>
  );
}

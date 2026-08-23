import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Copy,
  Layers3,
  Plus,
  Trash2,
  Users,
  X,
} from "./ui/Icon";
import { memberName } from "./ProjectControls";

function projectTitle(project: any) {
  return String(project?.title || project?.name || "Untitled project");
}

export type TemplateApplication = {
  title: string;
  client: string;
  bpo: string;
  startDate: string;
  projectManagerId: string;
  productOwnerId: string;
  sponsorId: string;
};

export function ProjectTemplatesPanel({
  templates,
  projects,
  workspaceMembers,
  onClose,
  onCreate,
  onDelete,
  onApply,
}: {
  templates: any[];
  projects: any[];
  workspaceMembers: any[];
  onClose: () => void;
  onCreate: (sourceProjectId: string, name: string, description: string) => Promise<void> | void;
  onDelete: (templateId: string) => Promise<void> | void;
  onApply: (template: any, application: TemplateApplication) => Promise<void> | void;
}) {
  const [sourceProjectId, setSourceProjectId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [selectedId, setSelectedId] = useState(templates[0]?.id || "");
  const [projectName, setProjectName] = useState("");
  const [client, setClient] = useState("");
  const [bpo, setBpo] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [projectManagerId, setProjectManagerId] = useState("");
  const [productOwnerId, setProductOwnerId] = useState("");
  const [sponsorId, setSponsorId] = useState("");
  const [working, setWorking] = useState(false);

  const selected = templates.find((template) => template.id === selectedId) || null;
  const members = useMemo(
    () => workspaceMembers.filter((member) => String(member.status || "active") !== "removed"),
    [workspaceMembers],
  );
  useEffect(() => {
    if (selected || !templates[0]) return;
    setSelectedId(templates[0].id);
    setProjectName(`${templates[0].name || "Project"}`.replace(/\s+template$/i, ""));
  }, [selected, templates]);
  const choose = (template: any) => {
    setSelectedId(template.id);
    setProjectName(`${template.name || "Project"}`.replace(/\s+template$/i, ""));
  };
  const create = async () => {
    if (!sourceProjectId || !templateName.trim() || working) return;
    setWorking(true);
    try {
      await onCreate(sourceProjectId, templateName.trim(), templateDescription.trim());
      setTemplateName("");
      setTemplateDescription("");
    } finally {
      setWorking(false);
    }
  };
  const apply = async () => {
    if (!selected || !projectName.trim() || !startDate || working) return;
    setWorking(true);
    try {
      await onApply(selected, {
        title: projectName.trim(),
        client: client.trim(),
        bpo: bpo.trim(),
        startDate,
        projectManagerId,
        productOwnerId,
        sponsorId,
      });
      onClose();
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="do-project-templates" aria-label="Project templates">
      <header>
        <div><span>WORKSPACE LIBRARY</span><h2>Project templates</h2><p>Reuse proven structure, relative dates and role placeholders.</p></div>
        <button aria-label="Close project templates" onClick={onClose} type="button"><X size={17} /></button>
      </header>
      <div className="do-template-layout">
        <aside>
          <div className="do-template-list-head"><strong>Templates</strong><span>{templates.length}</span></div>
          <div className="do-template-list">
            {templates.map((template) => (
              <button className={selectedId === template.id ? "is-active" : ""} key={template.id} onClick={() => choose(template)} type="button">
                <Layers3 size={15} />
                <span><strong>{template.name}</strong><small>{template.items?.length || 0} work items · {template.sourceProjectName || "Custom"}</small></span>
                <ArrowRight size={13} />
              </button>
            ))}
            {!templates.length && <div className="do-template-empty"><Copy size={18} /><strong>No templates yet</strong><span>Save one of your best projects below.</span></div>}
          </div>
          <div className="do-template-create">
            <strong>Save a project as template</strong>
            <select aria-label="Source project" onChange={(event) => { setSourceProjectId(event.target.value); const source = projects.find((project) => project.id === event.target.value); if (source && !templateName) setTemplateName(`${projectTitle(source)} template`); }} value={sourceProjectId}>
              <option value="">Choose source project</option>
              {projects.filter((project) => !["deleted", "archived"].includes(String(project.status))).map((project) => <option key={project.id} value={project.id}>{projectTitle(project)}</option>)}
            </select>
            <input aria-label="Template name" onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" value={templateName} />
            <textarea aria-label="Template description" onChange={(event) => setTemplateDescription(event.target.value)} placeholder="When should the team use this?" rows={2} value={templateDescription} />
            <button disabled={!sourceProjectId || !templateName.trim() || working} onClick={create} type="button"><Plus size={13} /> Save template</button>
          </div>
        </aside>
        <main>
          {selected ? (
            <>
              <div className="do-template-preview">
                <span>TEMPLATE PREVIEW</span><h3>{selected.name}</h3><p>{selected.description || "Reusable project structure for this workspace."}</p>
                <div><span><Layers3 size={13} /> {selected.items?.length || 0} items</span><span><CalendarClock size={13} /> Relative schedule</span><span><Users size={13} /> 3 role placeholders</span></div>
              </div>
              <div className="do-template-apply">
                <div><strong>Create project from template</strong><small>Dates move from the new start date. Roles are assigned now, not copied from the old project.</small></div>
                <label className="is-wide"><span>New project name</span><input autoFocus onChange={(event) => setProjectName(event.target.value)} value={projectName} /></label>
                <label><span>Client</span><input onChange={(event) => setClient(event.target.value)} placeholder="Client or internal" value={client} /></label>
                <label><span>BPO</span><input onChange={(event) => setBpo(event.target.value)} placeholder="BPO or business unit" value={bpo} /></label>
                <label><span>Project start</span><input onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} /></label>
                <label><span>Project Manager</span><select onChange={(event) => setProjectManagerId(event.target.value)} value={projectManagerId}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{memberName(member)}</option>)}</select></label>
                <label><span>Product Owner</span><select onChange={(event) => setProductOwnerId(event.target.value)} value={productOwnerId}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{memberName(member)}</option>)}</select></label>
                <label><span>Sponsor</span><select onChange={(event) => setSponsorId(event.target.value)} value={sponsorId}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{memberName(member)}</option>)}</select></label>
                <footer><button className="is-danger" onClick={() => window.confirm(`Delete ${selected.name}?`) && onDelete(selected.id)} type="button"><Trash2 size={13} /> Delete template</button><button disabled={!projectName.trim() || !startDate || working} onClick={apply} type="button">Use template <ArrowRight size={13} /></button></footer>
              </div>
            </>
          ) : (
            <div className="do-template-empty is-large"><Layers3 size={25} /><strong>Create your first reusable project</strong><span>Select a proven project, save its structure, then apply it with a new start date and accountable roles.</span></div>
          )}
        </main>
      </div>
    </section>
  );
}

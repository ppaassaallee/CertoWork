import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bug, Lock, Plus, Settings2, Trash2 } from "lucide-react";
import {
  controlledListLabels,
  controlledOptions,
  editableControlledGroups,
  lockedControlledGroups,
  systemControlledOptions,
  type ControlledListGroup,
  type ControlledListOption,
} from "../lib/controlledLists";
import {
  clearClientExceptionTraces,
  readClientExceptionTraces,
  type ClientExceptionTrace,
} from "../lib/clientExceptions";

function discoveredValuesForGroup(
  group: ControlledListGroup,
  projects: any[],
  tasks: any[],
) {
  if (group === "delivery_entity")
    return [
      ...projects.map((project) => project.deliveryEntity || project.bpo),
      ...tasks.map((task) => task.deliveryEntity || task.bpo),
    ].map((value) => String(value || "").trim());
  if (group === "client_entity")
    return [
      ...projects.map((project) => project.clientEntity || project.client),
      ...tasks.map((task) => task.clientEntity || task.client),
    ].map((value) => String(value || "").trim());
  return [];
}

function EditableOptionRow({
  group,
  option,
  onPromote,
  onRename,
  onDelete,
}: {
  group: ControlledListGroup;
  option: ControlledListOption;
  onPromote: (group: ControlledListGroup, name: string) => void;
  onRename: (
    group: ControlledListGroup,
    option: ControlledListOption,
    name: string,
  ) => void;
  onDelete: (group: ControlledListGroup, option: ControlledListOption) => void;
}) {
  const [draft, setDraft] = useState(option.name);
  const isMaster = Boolean(option.id);
  const cleaned = draft.trim();
  const changed = cleaned && cleaned !== option.name;
  const commitRename = () => {
    if (changed) onRename(group, option, cleaned);
    else setDraft(option.name);
  };
  useEffect(() => {
    setDraft(option.name);
  }, [option.name]);
  return (
    <div className="do-controlled-option">
      <input
        aria-label={`${controlledListLabels[group]} option`}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitRename();
          if (event.key === "Escape") setDraft(option.name);
        }}
        onBlur={() => !changed && setDraft(option.name)}
        title={isMaster ? "Rename this list value" : "Rename this discovered value and add it to the master list"}
        value={draft}
      />
      {changed ? (
        <button className="is-primary" onMouseDown={(event) => event.preventDefault()} onClick={commitRename} type="button">
          Save
        </button>
      ) : isMaster ? (
        <span>Master</span>
      ) : (
        <button onClick={() => onPromote(group, option.name)} type="button">
          Add to master
        </button>
      )}
      {!changed && (
        <button
          className="is-danger"
          onClick={() => onDelete(group, option)}
          title={`Remove ${option.name} from this list and clear matching records`}
          type="button"
        >
          <Trash2 size={12} /> Remove
        </button>
      )}
    </div>
  );
}

export function ControlledListsSettings({
  categories,
  projects,
  tasks,
  onBack,
  onCreateOption,
  onRenameOption,
  onDeleteOption,
}: {
  categories: any[];
  projects: any[];
  tasks: any[];
  onBack: () => void;
  onCreateOption: (
    group: "delivery_entity" | "client_entity" | "tag",
    name: string,
  ) => Promise<void> | void;
  onRenameOption: (
    group: "delivery_entity" | "client_entity" | "tag",
    option: ControlledListOption,
    name: string,
  ) => Promise<void> | void;
  onDeleteOption: (
    group: "delivery_entity" | "client_entity" | "tag",
    option: ControlledListOption,
  ) => Promise<void> | void;
}) {
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [traces, setTraces] = useState<ClientExceptionTrace[]>(() =>
    readClientExceptionTraces(),
  );
  useEffect(() => {
    const refresh = () => setTraces(readClientExceptionTraces());
    window.addEventListener("certo-client-exception", refresh);
    return () => window.removeEventListener("certo-client-exception", refresh);
  }, []);
  const sections = useMemo(
    () =>
      editableControlledGroups.map((group) => ({
        group,
        options: controlledOptions(
          categories,
          group,
          discoveredValuesForGroup(group, projects, tasks),
        ),
      })),
    [categories, projects, tasks],
  );

  const addValue = async (group: "delivery_entity" | "client_entity" | "tag") => {
    const value = String(newValues[group] || "").trim();
    if (!value) return;
    await onCreateOption(group, value);
    setNewValues((current) => ({ ...current, [group]: "" }));
  };

  return (
    <section className="do-controlled-settings" aria-label="Controlled lists">
      <header>
        <button onClick={onBack} type="button">
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <span>
            <Settings2 size={14} /> USER SETTINGS
          </span>
          <h1>Controlled lists</h1>
          <p>
            Maintain the dropdown values that classify projects, backlog items
            and portfolio reporting. Editable master data can be added or
            renamed here. Values are not deleted from here so historical records
            remain readable.
          </p>
        </div>
      </header>

      <div className="do-controlled-grid">
        {sections.map(({ group, options }) => (
          <section className="do-controlled-card" key={group}>
            <div>
              <span>{controlledListLabels[group]}</span>
              <small>
                {group === "tag"
                  ? "Reusable labels for projects, PBIs, notes and views."
                  : "Master data for portfolio and item dropdowns."}
              </small>
            </div>
            <div className="do-controlled-add">
              <input
                aria-label={`New ${controlledListLabels[group]}`}
                onChange={(event) =>
                  setNewValues((current) => ({
                    ...current,
                    [group]: event.target.value,
                  }))
                }
                onKeyDown={(event) =>
                  event.key === "Enter" &&
                  addValue(group as "delivery_entity" | "client_entity" | "tag")
                }
                placeholder={`Add ${controlledListLabels[group]}`}
                value={newValues[group] || ""}
              />
              <button
                onClick={() =>
                  addValue(group as "delivery_entity" | "client_entity" | "tag")
                }
                type="button"
              >
                <Plus size={13} /> Add
              </button>
            </div>
            <div className="do-controlled-options">
              {options.map((option) => (
                <EditableOptionRow
                  group={group}
                  key={`${group}-${option.id || option.name}`}
                  onPromote={(nextGroup, name) =>
                    onCreateOption(
                      nextGroup as "delivery_entity" | "client_entity" | "tag",
                      name,
                    )
                  }
                  onRename={(nextGroup, item, name) =>
                    onRenameOption(
                      nextGroup as "delivery_entity" | "client_entity" | "tag",
                      item,
                      name,
                    )
                  }
                  onDelete={(nextGroup, item) =>
                    onDeleteOption(
                      nextGroup as "delivery_entity" | "client_entity" | "tag",
                      item,
                    )
                  }
                  option={option}
                />
              ))}
              {options.length === 0 && <p>No values yet.</p>}
            </div>
          </section>
        ))}
      </div>

      <section className="do-controlled-locked">
        <div>
          <span>
            <Lock size={13} /> Locked workflow lists
          </span>
          <p>
            These are still locked at runtime because they drive automation,
            project health, dashboards, filters and reports. They can be changed
            safely only through a versioned release/migration; for flexible
            classification use Tags or Delivery/Client Entity.
          </p>
        </div>
        <div>
          {lockedControlledGroups.map((group) => (
            <section key={group}>
              <strong>{controlledListLabels[group]}</strong>
              <div>
                {systemControlledOptions(group).map((option) => (
                  <span key={option.name}>{option.name}</span>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <details className="do-controlled-diagnostics">
        <summary>
          <Bug size={13} /> Exception trace
        </summary>
        <div>
          <p>
            Recent client-side errors for controlled lists and settings. Use
            this when a value appears to save and then comes back.
          </p>
          <div className="do-controlled-diagnostics-actions">
            <button onClick={() => setTraces(readClientExceptionTraces())} type="button">
              Refresh
            </button>
            <button
              onClick={() => {
                clearClientExceptionTraces();
                setTraces([]);
              }}
              type="button"
            >
              Clear
            </button>
          </div>
          {traces.slice(0, 8).map((trace) => (
            <article key={trace.id}>
              <strong>{trace.area} · {trace.action}</strong>
              <span>{new Date(trace.createdAt).toLocaleString()}</span>
              <code>{trace.message}</code>
            </article>
          ))}
          {traces.length === 0 && <small>No exceptions recorded on this device.</small>}
        </div>
      </details>
    </section>
  );
}

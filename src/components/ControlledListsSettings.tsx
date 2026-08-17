import { useMemo, useState } from "react";
import { ArrowLeft, Lock, Plus, Settings2 } from "lucide-react";
import {
  controlledListLabels,
  controlledOptions,
  editableControlledGroups,
  lockedControlledGroups,
  systemControlledOptions,
  type ControlledListGroup,
  type ControlledListOption,
} from "../lib/controlledLists";

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
}: {
  group: ControlledListGroup;
  option: ControlledListOption;
  onPromote: (group: ControlledListGroup, name: string) => void;
  onRename: (
    group: ControlledListGroup,
    option: ControlledListOption,
    name: string,
  ) => void;
}) {
  const [draft, setDraft] = useState(option.name);
  return (
    <div className="do-controlled-option">
      <input
        aria-label={`${controlledListLabels[group]} option`}
        disabled={!option.id}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        onBlur={() => {
          const cleaned = draft.trim();
          if (option.id && cleaned && cleaned !== option.name)
            onRename(group, option, cleaned);
          else setDraft(option.name);
        }}
        value={draft}
      />
      {option.id ? (
        <span>Rename only</span>
      ) : (
        <button onClick={() => onPromote(group, option.name)} type="button">
          Add to list
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
}) {
  const [newValues, setNewValues] = useState<Record<string, string>>({});
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
            <Settings2 size={14} /> SETTINGS
          </span>
          <h1>Controlled lists</h1>
          <p>
            Maintain the dropdown values that classify projects, backlog items
            and portfolio reporting. Values cannot be deleted from here; rename
            them to preserve history.
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
            These lists drive automation, health logic, schedule filters and
            reporting. They are shown here so the team knows the standards, but
            they are intentionally not deletable or free-text editable.
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
    </section>
  );
}

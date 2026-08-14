import { Info, Users } from "lucide-react";

export type AssignableMember = {
  id: string;
  displayName?: string;
  email?: string;
  emailLower?: string;
  status?: string;
};

export function memberName(member: AssignableMember) {
  return String(member.displayName || member.email || member.emailLower || "Team member").trim();
}

export function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <span className="cw-info-tip" tabIndex={0} aria-label={`${label}: ${text}`}>
      <Info size={12} />
      <span role="tooltip"><strong>{label}</strong>{text}</span>
    </span>
  );
}

export function MultiAssigneePicker({
  members,
  selectedIds = [],
  selectedNames = [],
  onChange,
  label = "Assignees",
}: {
  members: AssignableMember[];
  selectedIds?: string[];
  selectedNames?: string[];
  onChange: (ids: string[], names: string[]) => void;
  label?: string;
}) {
  const activeMembers = members.filter((member) => String(member.status || "active") !== "removed");
  const normalizedNames = selectedNames.map((name) => String(name).trim()).filter(Boolean);
  const selected = activeMembers.filter((member) => selectedIds.includes(member.id) || normalizedNames.includes(memberName(member)));
  const toggle = (member: AssignableMember) => {
    const isSelected = selected.some((candidate) => candidate.id === member.id);
    const next = isSelected ? selected.filter((candidate) => candidate.id !== member.id) : [...selected, member];
    onChange(next.map((candidate) => candidate.id), next.map(memberName));
  };

  return (
    <details className="cw-multi-assignee">
      <summary aria-label={`${label}: ${selected.length} selected`}>
        <Users size={12} />
        <span>{selected.length ? selected.slice(0, 2).map(memberName).join(", ") : "Unassigned"}{selected.length > 2 ? ` +${selected.length - 2}` : ""}</span>
      </summary>
      <div>
        <header><strong>{label}</strong><small>Select one or many people</small></header>
        {activeMembers.map((member) => {
          const checked = selected.some((candidate) => candidate.id === member.id);
          return <label key={member.id}><input checked={checked} onChange={() => toggle(member)} type="checkbox" /><span><strong>{memberName(member)}</strong><small>{member.email || member.emailLower || "Workspace member"}</small></span></label>;
        })}
        {activeMembers.length === 0 && <p>Invite members from Workspace & team first.</p>}
      </div>
    </details>
  );
}

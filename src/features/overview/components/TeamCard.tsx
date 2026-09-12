import type { OverviewTeamMember } from "../useOverviewData";

export function TeamCard({
  members,
  onSeeAll,
}: {
  members: OverviewTeamMember[];
  onSeeAll?: () => void;
}) {
  if (!members.length) return null;
  const shown = members.slice(0, 4);
  const extra = Math.max(0, members.length - 3);

  return (
    <section className="cw-overview-card" data-testid="overview-team-card">
      <header className="cw-overview-card-head">
        <h3>Equipo</h3>
        {onSeeAll ? (
          <button className="cw-overview-link" onClick={onSeeAll} type="button">
            Ver todos
          </button>
        ) : null}
      </header>
      <div className="cw-overview-avatar-stack" aria-hidden="true">
        {members.slice(0, 3).map((member) => (
          <span className="cw-overview-avatar" key={member.id} title={member.label}>
            {member.avatar}
          </span>
        ))}
        {extra > 0 ? <span className="cw-overview-avatar is-more">+{extra}</span> : null}
      </div>
      <ul className="cw-overview-team-list">
        {shown.map((member) => (
          <li key={member.id}>
            <span className="cw-overview-avatar">{member.avatar}</span>
            <div>
              <strong>{member.label}</strong>
              <small>{member.role}</small>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

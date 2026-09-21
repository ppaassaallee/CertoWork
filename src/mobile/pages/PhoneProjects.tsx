import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMobileHeader } from "../MobileChromeContext";
import { MChip, MEmpty, MListRow, MSegmented, MSheet } from "../ui";
import { formatDate } from "../../shared/formatDate";
import { useTablesEnabled } from "../../features/flags/featureUserFlags";

type Seg = "overview" | "list" | "costs" | "tables";

export function PhoneProjects({
  projects,
  attention,
  kpis,
  tables = [],
}: {
  projects: Array<{
    id: string;
    title: string;
    stage?: string;
    health?: string;
    owner?: string;
    nextCheckpoint?: unknown;
    updatedAt?: unknown;
  }>;
  attention: Array<{ id: string; title: string; reason: string }>;
  kpis: Array<{ label: string; value: string }>;
  tables?: Array<{ id: string; name: string; recordCount?: number; icon?: string }>;
}) {
  const navigate = useNavigate();
  const tablesEnabled = useTablesEnabled();
  const [seg, setSeg] = useState<Seg>("overview");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showTable, setShowTable] = useState(false);

  useMobileHeader({ title: "Projects" });

  return (
    <div className="m-phone-pad" data-testid="phone-projects">
      <MSegmented
        onChange={(id) => setSeg(id as Seg)}
        options={[
          { id: "overview", label: "Overview" },
          { id: "list", label: "List" },
          { id: "costs", label: "Costs" },
          ...(tablesEnabled ? [{ id: "tables", label: "Tables" }] : []),
        ]}
        value={seg}
      />

      {seg === "tables" && tablesEnabled ? (
        <div style={{ marginTop: 12 }} data-testid="phone-projects-tables">
          {!tables.length ? (
            <MEmpty title="No tables yet. Create one from the Tables sidebar." />
          ) : (
            tables.map((t) => (
              <MListRow
                key={t.id}
                twoLine
                title={`${t.icon || "▦"} ${t.name}`}
                subtitle={`${t.recordCount || 0} records`}
                onClick={() => navigate(`/tables/${encodeURIComponent(t.id)}`)}
              />
            ))
          )}
        </div>
      ) : null}

      {seg === "overview" ? (
        <>
          <div className="m-hscroll" style={{ marginTop: 12 }}>
            {kpis.map((k) => (
              <MChip key={k.label} onClick={() => setSeg("list")}>
                {k.value} {k.label}
              </MChip>
            ))}
          </div>
          {attention.length ? (
            <div className="m-card" style={{ marginTop: 12 }}>
              <h3>Needs your attention</h3>
              {attention.slice(0, 3).map((row) => (
                <MListRow
                  key={row.id}
                  onClick={() => navigate(`/work/projects/${row.id}`)}
                  subtitle={row.reason}
                  title={row.title}
                  twoLine
                />
              ))}
            </div>
          ) : null}
          <div className="m-card">
            <h3>Projects</h3>
            {projects.slice(0, 5).map((p) => (
              <MListRow
                key={p.id}
                meta={p.stage}
                onClick={() => navigate(`/work/projects/${p.id}`)}
                subtitle={[p.owner, formatDate(p.nextCheckpoint as never)].filter(Boolean).join(" · ")}
                title={p.title}
                twoLine
              />
            ))}
          </div>
        </>
      ) : null}

      {seg === "list" ? (
        <>
          <div className="m-chip-row">
            <MChip chevron onClick={() => setFilterOpen(true)}>
              Filter & sort
            </MChip>
            <MChip onClick={() => setShowTable((v) => !v)}>
              {showTable ? "Show as cards" : "Show as table"}
            </MChip>
          </div>
          <p className="m-caption">{projects.length} projects</p>
          {showTable ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th align="left">Name</th>
                    <th align="left">Stage</th>
                    <th align="left">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <button
                          onClick={() => navigate(`/work/projects/${p.id}`)}
                          style={{ border: 0, background: "none", color: "var(--c-blue)" }}
                          type="button"
                        >
                          {p.title}
                        </button>
                      </td>
                      <td>{p.stage || "—"}</td>
                      <td>{formatDate(p.updatedAt as never) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            projects.map((p) => (
              <MListRow
                key={p.id}
                meta={formatDate(p.updatedAt as never)}
                onClick={() => navigate(`/work/projects/${p.id}`)}
                subtitle={[p.health, p.stage, formatDate(p.nextCheckpoint as never)]
                  .filter(Boolean)
                  .join(" · ")}
                title={p.title}
                twoLine
              />
            ))
          )}
          {!projects.length ? <MEmpty title="No projects yet. Tap + to create one." /> : null}
        </>
      ) : null}

      {seg === "costs" ? (
        <MEmpty title="Open Costs from desktop for the full ledger, or use Filters on List." />
      ) : null}

      <MSheet
        footer={
          <button className="m-btn m-btn-primary is-full" onClick={() => setFilterOpen(false)} type="button">
            Show {projects.length} projects
          </button>
        }
        onClose={() => setFilterOpen(false)}
        open={filterOpen}
        title="Filter & sort"
      >
        <p className="m-caption">
          Stage, Phase, Health, Tag, Category, Product Phase, Sort — same fields as the desktop dropdowns.
        </p>
      </MSheet>
    </div>
  );
}

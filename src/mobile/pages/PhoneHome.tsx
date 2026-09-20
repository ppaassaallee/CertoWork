import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star } from "../../components/ui/Icon";
import { useMobileHeader } from "../MobileChromeContext";
import { MButton, MListRow } from "../ui";
import { enableDailyPlan, useDailyPlanEnabled } from "../../features/dailyPlan";
import { PhoneDailyBriefCard } from "../../features/brief";
import { useDailyBriefEnabled } from "../../features/flags/featureUserFlags";
import { useAuth } from "../../lib/AuthContext";

export function PhoneHome({
  workspaceName,
  greeting,
  overdueCount,
  dueTodayCount,
  plannedCount,
  doneCount,
  keyTaskTitle,
  projects,
  onOpenOdysseus: _onOpenOdysseus,
  onOpenWorkspace,
}: {
  workspaceName: string;
  greeting: string;
  overdueCount: number;
  dueTodayCount: number;
  plannedCount: number;
  doneCount: number;
  keyTaskTitle?: string | null;
  projects: Array<{ id: string; title: string; health?: string }>;
  onOpenOdysseus: () => void;
  onOpenWorkspace: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dailyPlanOn = useDailyPlanEnabled();
  const briefOn = useDailyBriefEnabled();
  const [enabling, setEnabling] = useState(false);

  const dateTitle = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
  }, []);

  useMobileHeader({
    title: dateTitle,
    subtitle: `${workspaceName} ▾`,
    onSubtitleClick: onOpenWorkspace,
  });

  const sentence =
    dueTodayCount === 0 && overdueCount === 0
      ? "Nothing due today."
      : dueTodayCount === 0
        ? `Nothing due today. ${overdueCount} overdue items wait in My Work.`
        : `${dueTodayCount} due today${overdueCount ? `, ${overdueCount} overdue.` : "."}`;

  return (
    <div className="m-phone-pad" data-testid="phone-home">
      <p style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>{greeting}</p>
      {briefOn ? (
        <PhoneDailyBriefCard
          brief={null}
          onOpenFull={() => navigate("/home")}
        />
      ) : null}
      <p style={{ margin: "0 0 16px", color: "var(--c-ink-2)" }}>
        {sentence}{" "}
        {overdueCount > 0 ? (
          <button
            onClick={() => navigate("/my-work?filter=overdue")}
            style={{ color: "var(--c-blue)", background: "none", border: 0, fontWeight: 600 }}
            type="button"
          >
            Open overdue
          </button>
        ) : null}
      </p>

      <div className="m-card">
        <h3>Today</h3>
        {dailyPlanOn && plannedCount > 0 ? (
          <>
            {keyTaskTitle ? (
              <MListRow
                leading={<Star size={16} />}
                title={keyTaskTitle}
              />
            ) : null}
            <p className="m-caption">
              {plannedCount} planned · {doneCount} done
            </p>
            <MButton onClick={() => navigate("/my-work?view=today")} size="sm" variant="secondary">
              Open today
            </MButton>
          </>
        ) : (
          <MButton
            loading={enabling}
            onClick={() => {
              if (!dailyPlanOn && user?.uid) {
                setEnabling(true);
                void enableDailyPlan(user.uid).finally(() => {
                  setEnabling(false);
                  navigate("/my-work?view=today");
                });
                return;
              }
              navigate("/my-work?view=today");
            }}
            size="sm"
            variant="secondary"
          >
            Plan today · 5 min
          </MButton>
        )}
      </div>

      <div className="m-card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>My projects</h3>
          <button
            onClick={() => navigate("/projects")}
            style={{ border: 0, background: "none", color: "var(--c-blue)", fontWeight: 600 }}
            type="button"
          >
            See all
          </button>
        </div>
        <div className="m-hscroll">
          {projects.slice(0, 8).map((p) => (
            <button
              className="m-project-card"
              key={p.id}
              onClick={() => navigate(`/work/projects/${p.id}`)}
              type="button"
            >
              <strong>{p.title}</strong>
              <span className="m-caption">{p.health || "On track"}</span>
            </button>
          ))}
          {!projects.length ? <p className="m-caption">No projects yet.</p> : null}
        </div>
      </div>
    </div>
  );
}

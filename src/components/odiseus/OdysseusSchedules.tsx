import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { CalendarDays, Loader2, Plus, Trash2 } from "../ui/Icon";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/AuthContext";

type Schedule = {
  id: string;
  title?: string;
  cron?: string;
  prompt?: string;
  enabled?: boolean;
};

const PRESETS = [
  { label: "Weekdays 9:00", cron: "0 9 * * 1-5" },
  { label: "Monday 8:00", cron: "0 8 * * 1" },
  { label: "Daily 18:00", cron: "0 18 * * *" },
];

export function OdysseusSchedules({
  onRunNow,
}: {
  onRunNow: (prompt: string) => void;
}) {
  const { user, workspace } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [title, setTitle] = useState("Morning portfolio pulse");
  const [cron, setCron] = useState("0 9 * * 1-5");
  const [prompt, setPrompt] = useState(
    "Summarize blocked and at-risk projects, overdue items, and the top three actions for today.",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !workspace) return;
    const q = query(
      collection(db, "scheduled_tasks"),
      where("userId", "==", user.uid),
      where("workspaceId", "==", workspace.id),
    );
    return onSnapshot(
      q,
      (snap) => {
        setSchedules(
          snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Schedule),
        );
      },
      () => setSchedules([]),
    );
  }, [user, workspace]);

  const createSchedule = async () => {
    if (!user || !workspace || !title.trim() || !prompt.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "scheduled_tasks"), {
        userId: user.uid,
        workspaceId: workspace.id,
        title: title.trim(),
        cron: cron.trim() || "0 9 * * 1-5",
        prompt: prompt.trim(),
        enabled: true,
        owner: "odiseus",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTitle("");
      setPrompt("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="do-odiseus-schedules" data-testid="odiseus-schedules">
      <header>
        <CalendarDays size={16} />
        <div>
          <strong>Odysseus schedules</strong>
          <p>Recurring prompts Odysseus can run. Use Run now any time; cron is stored for automation hooks.</p>
        </div>
      </header>

      <section className="do-odiseus-schedule-form">
        <input
          aria-label="Schedule title"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Schedule name"
          value={title}
        />
        <div className="do-odiseus-schedule-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.cron}
              className={cron === preset.cron ? "is-active" : ""}
              onClick={() => setCron(preset.cron)}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          aria-label="Cron expression"
          onChange={(event) => setCron(event.target.value)}
          placeholder="cron"
          value={cron}
        />
        <textarea
          aria-label="Schedule prompt"
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="What should Odysseus do?"
          rows={3}
          value={prompt}
        />
        <button disabled={saving || !title.trim() || !prompt.trim()} onClick={createSchedule} type="button">
          {saving ? <Loader2 className="spin" size={14} /> : <Plus size={14} />}
          Add schedule
        </button>
      </section>

      <ul className="do-odiseus-schedule-list">
        {schedules.map((schedule) => (
          <li key={schedule.id}>
            <div>
              <strong>{schedule.title || "Scheduled job"}</strong>
              <small>{schedule.cron || "No cron"} · {schedule.enabled === false ? "Paused" : "Enabled"}</small>
              <p>{schedule.prompt}</p>
            </div>
            <div className="do-odiseus-schedule-actions">
              <button
                onClick={() => onRunNow(String(schedule.prompt || "").trim())}
                type="button"
              >
                Run now
              </button>
              <button
                aria-label={`Toggle ${schedule.title || "schedule"}`}
                onClick={() =>
                  updateDoc(doc(db, "scheduled_tasks", schedule.id), {
                    enabled: schedule.enabled === false,
                    updatedAt: serverTimestamp(),
                  })
                }
                type="button"
              >
                {schedule.enabled === false ? "Enable" : "Pause"}
              </button>
              <button
                aria-label={`Delete ${schedule.title || "schedule"}`}
                onClick={() => deleteDoc(doc(db, "scheduled_tasks", schedule.id))}
                type="button"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
        {schedules.length === 0 && (
          <li className="is-empty">No schedules yet. Add a morning pulse to start.</li>
        )}
      </ul>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Moon, Star } from "../../components/ui/Icon";
import type { DayPlan, FocusScore } from "../../lib/dayplan";
import { FocusRing } from "./FocusRing";
import { KeyTaskPicker, type KeyTaskPickerItem } from "./KeyTaskPicker";
import "./dayplan.css";

export type DayHeaderProps = {
  score: FocusScore;
  plan: DayPlan | null;
  keyItemTitle: string | null;
  onPickKey: (itemId: string | null) => void;
  onCloseDay: () => void;
  locale: "es" | "en";
  pickerItems?: KeyTaskPickerItem[];
};

function isAfterCloseHour(now = new Date()) {
  return now.getHours() >= 16;
}

export function DayHeader({
  score,
  plan,
  keyItemTitle,
  onPickKey,
  onCloseDay,
  locale,
  pickerItems = [],
}: DayHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const showClose = score.keyDone || isAfterCloseHour();
  const closed = Boolean(plan?.closedAt);
  const remainingLabel =
    locale === "es"
      ? `${score.remaining} por despejar`
      : `${score.remaining} to clear`;

  const keyLabel = useMemo(() => {
    if (keyItemTitle) return keyItemTitle;
    return locale === "es" ? "Elegí tu tarea clave" : "Pick your key task";
  }, [keyItemTitle, locale]);

  return (
    <div className="cw-dayplan-header" data-testid="day-header">
      <div className="cw-dayplan-header-main">
        <FocusRing size="sm" value={score.value} label={locale === "es" ? "Focus score de hoy" : "Today focus score"} />
        <span className="cw-dayplan-header-score">
          {locale === "es" ? "Hoy" : "Today"} · {score.value}%
        </span>
        <span className="cw-dayplan-sep" aria-hidden>
          ·
        </span>
        <button
          className={`cw-dayplan-key ${keyItemTitle ? "" : "is-empty"}`}
          onClick={() => setPickerOpen(true)}
          type="button"
        >
          {keyItemTitle ? <Star size={12} /> : null}
          <span>{keyLabel}</span>
        </button>
        {score.planned > 0 ? (
          <>
            <span className="cw-dayplan-sep" aria-hidden>
              ·
            </span>
            <span className="cw-dayplan-remaining">{remainingLabel}</span>
          </>
        ) : null}
      </div>
      {showClose ? (
        <button
          className="cw-dayplan-close"
          disabled={closed}
          onClick={() => {
            if (!closed) onCloseDay();
          }}
          title={closed ? (locale === "es" ? "Ya cerraste el día" : "Day already closed") : undefined}
          type="button"
        >
          <Moon size={12} />
          {locale === "es" ? "Cerrar el día" : "Close the day"}
        </button>
      ) : null}
      <KeyTaskPicker
        hasKey={Boolean(plan?.keyItemId)}
        items={pickerItems}
        locale={locale}
        onClose={() => setPickerOpen(false)}
        onPick={(id) => {
          onPickKey(id);
          setPickerOpen(false);
        }}
        open={pickerOpen}
      />
    </div>
  );
}

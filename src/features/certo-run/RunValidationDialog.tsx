import { useState } from "react";
import { validateRunIngest, type IntakeReport } from "../../lib/certoRun/validation";
import { RunDialog } from "./RunDialog";
import { runText as t, runError } from "./runCopy";
import { useLocale } from "../../lib/useLocale";

/** Inspection is local and read-only. No import is offered until server atomicity exists. */
export function RunValidationDialog({ onClose }: { onClose: () => void }) {
  useLocale();
  const [report, setReport] = useState<IntakeReport | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  return <RunDialog title={t("Data & validation")} onClose={onClose}>
      <p>{t("Check a certo-run-ingest/1 file before importing. Nothing is uploaded or changed.")}</p>
      <label className="cr-upload-picker"><span>{t("Choose JSON file")}</span><small>{name || t("No file selected")}</small><input className="cr-hidden-file" type="file" accept=".json,application/json" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setReport(null); setError(""); setName(file.name);
        if (file.size > 5 * 1024 * 1024) { setError("Choose a JSON file smaller than 5 MB."); return; }
        try { setReport(validateRunIngest(JSON.parse(await file.text()))); }
        catch { setError("Could not read valid JSON. Correct the file and try again."); }
      }} /></label>
      {error && <p className="cr-flag" role="alert">{runError(error)}</p>}
      {report && <section aria-live="polite">
        <h3>{name}</h3>
        <p className={report.ok ? "cr-good" : "cr-over"}>{report.errors.length} {t("blocking errors ·")} {report.warnings.length} {t("warnings")}</p>
        <p>{report.counts.items || 0} {t("items ·")} {report.counts.projects || 0} {t("projects ·")} {report.counts.allocations || 0} {t("allocations")}</p>
        {report.errors.length > 0 && <div className="cr-flag"><strong>{t("Fix these before import")}</strong><ul>{report.errors.map((message, i) => <li key={i}>{runError(message)}</li>)}</ul></div>}
        {report.warnings.length > 0 && <details><summary>{t("Review warnings (")}{report.warnings.length})</summary><ul>{report.warnings.map((message, i) => <li key={i}>{runError(message)}</li>)}</ul></details>}
      </section>}
      <p className="cr-muted">{t("Import and Replace are unavailable until atomic server validation, workspace mapping and approval safeguards are implemented. This check validates core item, world and allocation rules; it is not an import authorization.")}</p>
      <footer><button className="cr-solid" onClick={onClose} type="button">{t("Done")}</button></footer>
  </RunDialog>;
}

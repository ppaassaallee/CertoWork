import { useEffect, useRef, useState } from "react";
import { validateRunIngest, type IntakeReport } from "../../lib/certoRun/validation";

/** Inspection is local and read-only. No import is offered until server atomicity exists. */
export function RunValidationDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<IntakeReport | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button,input,a[href],[tabindex="0"]') || [])];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const node = dialog.current;
    node?.addEventListener("keydown", onKey);
    return () => { node?.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [onClose]);
  return <div className="cr-modal-back">
    <div className="cr-modal" role="dialog" aria-modal="true" aria-labelledby="run-validation-title" ref={dialog}>
      <header><h2 id="run-validation-title">Data & validation</h2><button className="cr-tool" onClick={onClose} type="button" aria-label="Close data validation">Close</button></header>
      <p>Check a certo-run-ingest/1 file before importing. Nothing is uploaded or changed.</p>
      <label className="cr-kicker">Choose JSON file<input type="file" accept=".json,application/json" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setReport(null); setError(""); setName(file.name);
        if (file.size > 5 * 1024 * 1024) { setError("Choose a JSON file smaller than 5 MB."); return; }
        try { setReport(validateRunIngest(JSON.parse(await file.text()))); }
        catch { setError("Could not read valid JSON. Correct the file and try again."); }
      }} /></label>
      {error && <p className="cr-flag" role="alert">{error}</p>}
      {report && <section aria-live="polite">
        <h3>{name}</h3>
        <p className={report.ok ? "cr-good" : "cr-over"}>{report.errors.length} blocking errors · {report.warnings.length} warnings</p>
        <p>{report.counts.items || 0} items · {report.counts.projects || 0} projects · {report.counts.allocations || 0} allocations</p>
        {report.errors.length > 0 && <div className="cr-flag"><strong>Fix these before import</strong><ul>{report.errors.map((message, i) => <li key={i}>{message}</li>)}</ul></div>}
        {report.warnings.length > 0 && <details><summary>Review warnings ({report.warnings.length})</summary><ul>{report.warnings.map((message, i) => <li key={i}>{message}</li>)}</ul></details>}
      </section>}
      <p className="cr-muted">Import and Replace are unavailable until atomic server validation, workspace mapping and approval safeguards are implemented. This check validates core item, world and allocation rules; it is not an import authorization.</p>
      <footer><button className="cr-solid" onClick={onClose} type="button">Done</button></footer>
    </div>
  </div>;
}

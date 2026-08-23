import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { downloadProjectStatusReport, projectStatusReportHtml } from "../lib/projectStatusReport";

export function PublicStatusReport({ token }: { token: string }) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const snap = await getDoc(doc(db, "project_status_shares", token));
        const data = snap.exists() ? snap.data() : null;
        if (!data || data.revoked || data.token !== token || !data.snapshot) {
          throw new Error("This status report link is invalid or has been revoked.");
        }
        if (data.expiresAt) {
          const expires = data.expiresAt?.toMillis?.() || Date.parse(String(data.expiresAt)) || 0;
          if (expires && expires < Date.now()) throw new Error("This status report link has expired.");
        }
        if (!active) return;
        setReport(data.snapshot);
        setHtml(projectStatusReportHtml(data.snapshot));
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "The report could not be opened.");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [token]);

  if (error) {
    return (
      <main className="do-signin">
        <section className="do-access-card" style={{ margin: "12vh auto", maxWidth: 480 }}>
          <h2>Report unavailable</h2>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!html) {
    return (
      <main className="do-loading">
        <span className="do-logo">C</span>
        <p>Opening status report…</p>
      </main>
    );
  }

  return (
    <main className="do-public-report">
      <header className="do-public-report-bar">
        <span>Certo Work · read-only status report</span>
        {report && (
          <button onClick={() => downloadProjectStatusReport(report)} type="button">
            Download PDF
          </button>
        )}
      </header>
      <iframe
        sandbox=""
        srcDoc={html}
        style={{ width: "100%", minHeight: "100vh", border: 0, background: "var(--surface-0)" }}
        title="Project status report"
      />
    </main>
  );
}

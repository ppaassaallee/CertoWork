import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  APPLE_WIDGET_COLLECTION,
  widgetApiPath,
  type AppleWidgetSnapshot,
} from "../lib/appleWidget";

export const APPLE_WIDGET_PREVIEW_SNAPSHOT: AppleWidgetSnapshot = {
  workspaceName: "Certo Work",
  dateLabel: "Today",
  dateKey: "",
  mustDos: [
    { id: "1", title: "Protect the core work" },
    { id: "2", title: "Move one project forward" },
  ],
  shouldDos: [
    { id: "3", title: "Clear messages" },
    { id: "4", title: "Update the weekly plan" },
    { id: "5", title: "Send the status note" },
  ],
  pendingApprovals: 0,
  odysseusLine: "Protect the two must-dos. Everything else can move.",
  updatedAt: 0,
};

function WidgetCard({
  snapshot,
  family,
}: {
  snapshot: AppleWidgetSnapshot;
  family: "iphone" | "mac";
}) {
  const must = (snapshot.mustDos || []).slice(0, 2);
  const should =
    family === "mac"
      ? (snapshot.shouldDos || []).slice(0, 6)
      : (snapshot.shouldDos || []).slice(0, 3);
  return (
    <article className={`do-apple-widget is-${family}`} data-testid={`apple-widget-${family}`}>
      <header>
        <span>Certo Work</span>
        <strong>{snapshot.dateLabel}</strong>
      </header>
      <p className="do-apple-widget-kicker">2 must-dos</p>
      {must.length ? (
        <ol>
          {must.map((item, index) => (
            <li key={item.id}>
              <em>{index + 1}</em>
              <span>
                {item.title}
                {item.project ? <small>{item.project}</small> : null}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="do-apple-widget-empty">No must-dos yet.</p>
      )}
      {should.length > 0 ? (
        <>
          <p className="do-apple-widget-kicker">Should dos</p>
          <ul>
            {should.map((item) => (
              <li key={item.id}>{item.title}</li>
            ))}
          </ul>
        </>
      ) : null}
      <footer>{snapshot.odysseusLine}</footer>
    </article>
  );
}

function isStandaloneWidget() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function PublicAppleWidget({ token }: { token: string }) {
  const [snapshot, setSnapshot] = useState<AppleWidgetSnapshot | null>(
    token === "preview" ? APPLE_WIDGET_PREVIEW_SNAPSHOT : null,
  );
  const [error, setError] = useState("");
  const [standalone, setStandalone] = useState(isStandaloneWidget);

  useEffect(() => {
    document.title = "Today — Certo Work";
    setStandalone(isStandaloneWidget());
  }, []);

  useEffect(() => {
    if (token === "preview") {
      setSnapshot(APPLE_WIDGET_PREVIEW_SNAPSHOT);
      setError("");
      return;
    }
    let active = true;
    async function load() {
      let apiError = "";
      try {
        const response = await fetch(widgetApiPath(token));
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload?.snapshot) {
          if (active) {
            setError("");
            setSnapshot(payload.snapshot as AppleWidgetSnapshot);
          }
          return;
        }
        apiError = String(payload?.error || "");
      } catch {
        /* WidgetKit feed may be unavailable locally; fall through to Firestore. */
      }
      try {
        const snap = await getDoc(doc(db, APPLE_WIDGET_COLLECTION, token));
        const data = snap.exists() ? snap.data() : null;
        if (!data || data.revoked || data.token !== token || !data.snapshot) {
          throw new Error(apiError || "This widget link is invalid or has been revoked.");
        }
        if (active) {
          setError("");
          setSnapshot(data.snapshot as AppleWidgetSnapshot);
        }
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "The widget could not be opened.");
        }
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 15 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token]);

  if (error) {
    return (
      <main className="do-apple-widget-page">
        <section className="do-apple-widget-copy">
          <strong>Widget unavailable</strong>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="do-apple-widget-page">
        <p>Opening your Certo Work widget…</p>
      </main>
    );
  }

  return (
    <main
      className={`do-apple-widget-page${standalone ? " is-standalone" : ""}`}
      data-testid="apple-widget-page"
    >
      {standalone ? null : (
        <section className="do-apple-widget-copy">
          <span className="do-kicker">{snapshot.workspaceName}</span>
          <h1>Today on Certo Work</h1>
          <p>
            Add this page to your iPhone Home Screen or Mac Dock. Native Home Screen and Desktop
            widgets live in the Certo Work Apple app.
          </p>
        </section>
      )}
      <div className="do-apple-widget-stage">
        {standalone ? (
          <WidgetCard family="mac" snapshot={snapshot} />
        ) : (
          <>
            <div>
              <span>iPhone</span>
              <WidgetCard family="iphone" snapshot={snapshot} />
            </div>
            <div>
              <span>Mac</span>
              <WidgetCard family="mac" snapshot={snapshot} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

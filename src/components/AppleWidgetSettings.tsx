import { widgetPublicPath } from "../lib/appleWidget";

export function AppleWidgetSettings({
  enabled,
  token,
  busy,
  error,
  onEnable,
  onRevoke,
}: {
  enabled: boolean;
  token: string;
  busy?: boolean;
  error?: string;
  onEnable: () => void;
  onRevoke: () => void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://certo.work";
  const pageUrl = token ? `${origin}${widgetPublicPath(token)}` : "";
  const apiUrl = token ? `${origin}/api/widget/${token}` : "";

  return (
    <section className="do-workspace-admin-card" data-testid="apple-widget-settings">
      <div className="do-workspace-admin-head">
        <span className="do-kicker">Apple</span>
        <strong>iPhone and Mac widgets</strong>
      </div>
      <p className="do-panel-intro">
        Pin today’s 2 must-dos and should-dos on your iPhone Home Screen and Mac Desktop or Notification Center.{" "}
        <a href="/widget/preview">See a preview</a>.
      </p>
      {error ? <p className="do-signin-error">{error}</p> : null}
      {!enabled ? (
        <button disabled={busy} onClick={onEnable} type="button">
          {busy ? "Creating widget…" : "Enable Apple widgets"}
        </button>
      ) : (
        <>
          <p className="do-panel-intro">
            Widget page: <a href={pageUrl}>{pageUrl}</a>
          </p>
          <div className="do-apple-widget-actions">
            <button
              onClick={() => void navigator.clipboard.writeText(pageUrl)}
              type="button"
            >
              Copy iPhone / Mac page
            </button>
            <button
              onClick={() => void navigator.clipboard.writeText(apiUrl)}
              type="button"
            >
              Copy WidgetKit feed
            </button>
          </div>
          <div className="do-apple-widget-steps">
            <div>
              <strong>iPhone</strong>
              <ol>
                <li>Open the widget page in Safari.</li>
                <li>Share → Add to Home Screen.</li>
                <li>For a true Home Screen widget, open <code>apple/CertoWork</code> in Xcode, run on your iPhone, then tap and hold the Home Screen → Add Widget → Certo Work.</li>
              </ol>
            </div>
            <div>
              <strong>Mac</strong>
              <ol>
                <li>Open the widget page in Safari.</li>
                <li>File → Add to Dock.</li>
                <li>Or run the Mac target from Xcode, then add Certo Work from Desktop / Notification Center widgets.</li>
              </ol>
            </div>
          </div>
          <button disabled={busy} onClick={onRevoke} type="button">
            Revoke widget
          </button>
        </>
      )}
    </section>
  );
}

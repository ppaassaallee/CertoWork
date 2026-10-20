import { widgetPublicPath } from "../lib/appleWidget";
import { useLocale } from "../lib/useLocale";

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
  const locale = useLocale();
  const tr = (en: string, es: string) => locale === "es" ? es : en;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://certo.work";
  const pageUrl = token ? `${origin}${widgetPublicPath(token)}` : "";
  const apiUrl = token ? `${origin}/api/widget/${token}` : "";

  return (
    <section className="do-workspace-admin-card" data-testid="apple-widget-settings">
      <div className="do-workspace-admin-head">
        <span className="do-kicker">Apple</span>
        <strong>{tr("iPhone and Mac widgets", "Widgets de iPhone y Mac")}</strong>
      </div>
      <p className="do-panel-intro">
        {tr("Pin today’s 2 must-dos and should-dos on your iPhone Home Screen and Mac Desktop or Notification Center.", "Fija las prioridades de hoy en la pantalla de inicio de tu iPhone o en el escritorio y centro de notificaciones de tu Mac.")}{" "}
        <a href="/widget/preview">{tr("See a preview", "Ver vista previa")}</a>.
      </p>
      {error ? <p className="do-signin-error">{error}</p> : null}
      {!enabled ? (
        <button disabled={busy} onClick={onEnable} type="button">
          {busy ? tr("Creating widget…", "Creando widget…") : tr("Enable Apple widgets", "Activar widgets de Apple")}
        </button>
      ) : (
        <>
          <p className="do-panel-intro">
            {tr("Widget page", "Página del widget")}: <a href={pageUrl}>{pageUrl}</a>
          </p>
          <div className="do-apple-widget-actions">
            <button
              onClick={() => void navigator.clipboard.writeText(pageUrl)}
              type="button"
            >
              {tr("Copy iPhone / Mac page", "Copiar página para iPhone / Mac")}
            </button>
            <button
              onClick={() => void navigator.clipboard.writeText(apiUrl)}
              type="button"
            >
              {tr("Copy WidgetKit feed", "Copiar feed de WidgetKit")}
            </button>
          </div>
          <div className="do-apple-widget-steps">
            <div>
              <strong>iPhone</strong>
              <ol>
                <li>{tr("Open the widget page in Safari.", "Abre la página del widget en Safari.")}</li>
                <li>{tr("Share → Add to Home Screen.", "Compartir → Añadir a la pantalla de inicio.")}</li>
                <li>{tr("For a true Home Screen widget, open", "Para un widget nativo, abre")} <code>apple/CertoWork</code> {tr("in Xcode, run on your iPhone, then tap and hold the Home Screen → Add Widget → Certo Work.", "en Xcode, ejecútalo en tu iPhone y mantén pulsada la pantalla de inicio → Añadir widget → Certo Work.")}</li>
              </ol>
            </div>
            <div>
              <strong>Mac</strong>
              <ol>
                <li>{tr("Open the widget page in Safari.", "Abre la página del widget en Safari.")}</li>
                <li>{tr("File → Add to Dock.", "Archivo → Añadir al Dock.")}</li>
                <li>{tr("Or run the Mac target from Xcode, then add Certo Work from Desktop / Notification Center widgets.", "O ejecuta la versión para Mac desde Xcode y añade Certo Work desde los widgets del escritorio o centro de notificaciones.")}</li>
              </ol>
            </div>
          </div>
          <button disabled={busy} onClick={onRevoke} type="button">
            {tr("Revoke widget", "Revocar widget")}
          </button>
        </>
      )}
    </section>
  );
}

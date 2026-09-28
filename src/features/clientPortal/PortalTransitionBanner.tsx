/** Banner shown on legacy public token pages pointing clients to the portal. */
export function PortalTransitionBanner({
  locale = "es",
  loginHref = "/portal/login",
}: {
  locale?: "en" | "es";
  loginHref?: string;
}) {
  const copy =
    locale === "en"
      ? {
          title: "This is now in your client portal",
          body: "Sign in with your work email to see projects, updates, invoices, and messages in one place.",
          cta: "Open client portal",
        }
      : {
          title: "Esto ahora está en tu portal de cliente",
          body: "Entrá con tu correo de trabajo para ver proyectos, actualizaciones, facturas y mensajes en un solo lugar.",
          cta: "Abrir portal",
        };
  return (
    <div
      style={{
        margin: "0 0 16px",
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid #d9e2ff",
        background: "linear-gradient(180deg,#eef3ff,#f8faff)",
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <div>
        <strong style={{ display: "block" }}>{copy.title}</strong>
        <span style={{ color: "#6b7280", fontSize: 13 }}>{copy.body}</span>
      </div>
      <a
        href={loginHref}
        style={{
          background: "#2547c4",
          color: "#fff",
          textDecoration: "none",
          padding: "8px 12px",
          borderRadius: 8,
          fontSize: 13,
        }}
      >
        {copy.cta}
      </a>
    </div>
  );
}

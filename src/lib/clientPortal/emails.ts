/**
 * Client portal transactional email templates (EN/ES) for Brevo sender.
 * One context line + one CTA button; deep link to portal page.
 */

export function portalEmailContent(input: {
  kind:
    | "invite"
    | "update"
    | "approval"
    | "request_reply"
    | "document"
    | "invoice"
    | "invoice_due"
    | "invoice_overdue"
    | "digest";
  locale?: "en" | "es";
  brandName?: string;
  deepLink: string;
  contextLine: string;
}) {
  const locale = input.locale === "en" ? "en" : "es";
  const brand = input.brandName || "Certo Work";
  const copy = {
    en: {
      invite: { subject: `${brand}: your client portal`, cta: "Open portal" },
      update: { subject: `${brand}: new project update`, cta: "Read update" },
      approval: { subject: `${brand}: decision needed`, cta: "Review" },
      request_reply: { subject: `${brand}: reply on your request`, cta: "Open request" },
      document: { subject: `${brand}: new document`, cta: "View document" },
      invoice: { subject: `${brand}: invoice issued`, cta: "View invoice" },
      invoice_due: { subject: `${brand}: invoice due in 5 days`, cta: "View invoice" },
      invoice_overdue: { subject: `${brand}: invoice overdue`, cta: "View invoice" },
      digest: { subject: `${brand}: weekly portal digest`, cta: "Open portal" },
    },
    es: {
      invite: { subject: `${brand}: tu portal de cliente`, cta: "Abrir portal" },
      update: { subject: `${brand}: nueva actualización`, cta: "Leer actualización" },
      approval: { subject: `${brand}: necesita tu decisión`, cta: "Revisar" },
      request_reply: { subject: `${brand}: respuesta a tu solicitud`, cta: "Abrir solicitud" },
      document: { subject: `${brand}: nuevo documento`, cta: "Ver documento" },
      invoice: { subject: `${brand}: factura emitida`, cta: "Ver factura" },
      invoice_due: { subject: `${brand}: factura vence en 5 días`, cta: "Ver factura" },
      invoice_overdue: { subject: `${brand}: factura vencida`, cta: "Ver factura" },
      digest: { subject: `${brand}: resumen semanal`, cta: "Abrir portal" },
    },
  }[locale][input.kind];

  const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#1f2430">
  <p>${escapeHtml(input.contextLine)}</p>
  <p><a href="${escapeAttr(input.deepLink)}" style="display:inline-block;background:#2547c4;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none">${escapeHtml(copy.cta)}</a></p>
  <p style="color:#6b7280;font-size:12px">${escapeHtml(brand)} · Client portal</p>
  </body></html>`;

  return {
    subject: copy.subject,
    html,
    text: `${input.contextLine}\n\n${copy.cta}: ${input.deepLink}`,
  };
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

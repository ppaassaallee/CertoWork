/** Worker-side portal email helpers (mirrors src/lib/clientPortal/emails.ts). */

export function portalEmailContent(body) {
  const locale = body?.locale === "en" ? "en" : "es";
  const brand = body?.brandName || "Certo Work";
  const kind = body?.kind || "invite";
  const deepLink = body?.deepLink || "https://certo.work/portal";
  const contextLine = body?.contextLine || "";
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
  }[locale][kind] || { subject: brand, cta: "Open" };

  return {
    subject: copy.subject,
    html: `<p>${contextLine}</p><p><a href="${deepLink}">${copy.cta}</a></p>`,
    text: `${contextLine}\n\n${copy.cta}: ${deepLink}`,
  };
}

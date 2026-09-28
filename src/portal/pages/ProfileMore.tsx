import { Link } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { PORTAL_MEMBERS_COLLECTION } from "../../lib/clientPortal/collections";
import { usePortal } from "../PortalContext";
import type { PortalLocale } from "../../lib/clientPortal/types";

export function PortalProfilePage() {
  const { t, member, user, locale, setLocale } = usePortal();

  const saveLocale = async (next: PortalLocale) => {
    setLocale(next);
    if (!user) return;
    await updateDoc(doc(db, PORTAL_MEMBERS_COLLECTION, user.uid), { locale: next }).catch(() => undefined);
  };

  return (
    <div className="cp-grid">
      <h1 style={{ margin: 0 }}>{t("profile")}</h1>
      <div className="cp-card">
        <div className="cp-row">
          <strong>{String(member?.name || user?.email || "")}</strong>
          <span className="cp-muted">{String(member?.title || member?.role || "")}</span>
        </div>
        <div className="cp-row">
          <span>{t("language")}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className={`cp-btn ${locale === "es" ? "" : "ghost"}`} onClick={() => saveLocale("es")} type="button">
              ES
            </button>
            <button className={`cp-btn ${locale === "en" ? "" : "ghost"}`} onClick={() => saveLocale("en")} type="button">
              EN
            </button>
          </div>
        </div>
        <div className="cp-muted">{t("notifications")}: {String((member?.notificationPrefs as any)?.digest || "immediate")}</div>
      </div>
    </div>
  );
}

export function PortalMorePage() {
  const { t } = usePortal();
  return (
    <div className="cp-grid">
      <h1 style={{ margin: 0 }}>{t("more")}</h1>
      <Link className="cp-card" to="/portal/documents">{t("documents")}</Link>
      <Link className="cp-card" to="/portal/invoices">{t("invoices")}</Link>
      <Link className="cp-card" to="/portal/approvals">{t("approvals")}</Link>
      <Link className="cp-card" to="/portal/profile">{t("profile")}</Link>
    </div>
  );
}

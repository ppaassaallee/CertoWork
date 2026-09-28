import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, Home, FolderKanban, Inbox, MessageSquare, MoreHorizontal } from "../components/ui/Icon";
import { usePortal } from "./PortalContext";

export function PortalShell() {
  const { t, brandName, meta, member, logOut } = usePortal();
  const navigate = useNavigate();
  const nav = meta?.nav;
  const initial = String(member?.name || member?.email || "C").slice(0, 1).toUpperCase();

  const link = (to: string, label: string, count?: number) => (
    <NavLink className={({ isActive }) => (isActive ? "is-active" : "")} to={to}>
      {label}
      {count ? <span className="cp-badge">{count}</span> : null}
    </NavLink>
  );

  return (
    <div className="cp-shell">
      <header className="cp-top">
        <div className="cp-brand">
          <div className="cp-brand-tile">{brandName.slice(0, 1)}</div>
          <div>
            <strong>{brandName}</strong>
            <span>{t("clientPortal")}</span>
          </div>
        </div>
        <nav className="cp-nav">
          {link("/portal", t("home"), nav?.home)}
          {link("/portal/projects", t("projects"), nav?.projects)}
          {link("/portal/requests", t("requests"), nav?.requests)}
          {link("/portal/invoices", t("invoices"), nav?.invoices)}
          {link("/portal/documents", t("documents"), nav?.documents)}
          {link("/portal/messages", t("messages"), nav?.messages)}
        </nav>
        <div className="cp-top-actions">
          <button className="cp-btn ghost" onClick={() => navigate("/portal/approvals")} type="button" aria-label={t("approvals")}>
            <Bell size={16} />
          </button>
          <button
            className="cp-avatar"
            onClick={() => navigate("/portal/profile")}
            type="button"
            title={t("profile")}
          >
            {initial}
          </button>
          <button className="cp-btn ghost" onClick={() => logOut()} type="button">
            {t("signOut")}
          </button>
        </div>
      </header>
      <main className="cp-main">
        <Outlet />
      </main>
      <nav className="cp-bottom" aria-label="Mobile">
        <NavLink className={({ isActive }) => (isActive ? "is-active" : "")} to="/portal" end>
          <Home size={18} />
          {t("home")}
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "is-active" : "")} to="/portal/projects">
          <FolderKanban size={18} />
          {t("projects")}
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "is-active" : "")} to="/portal/requests">
          <Inbox size={18} />
          {t("requests")}
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "is-active" : "")} to="/portal/messages">
          <MessageSquare size={18} />
          {t("messages")}
        </NavLink>
        <NavLink className={({ isActive }) => (isActive ? "is-active" : "")} to="/portal/more">
          <MoreHorizontal size={18} />
          {t("more")}
        </NavLink>
      </nav>
    </div>
  );
}

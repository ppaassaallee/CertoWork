import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { PortalProvider, usePortal } from "./PortalContext";
import { PortalShell } from "./PortalShell";
import { PortalLoginPage } from "./pages/Login";
import { PortalAuthPage } from "./pages/Auth";
import { PortalHomePage } from "./pages/Home";
import { PortalProjectsPage, PortalProjectPage } from "./pages/Project";
import { PortalRequestsPage } from "./pages/Requests";
import { PortalDocumentsPage, PortalInvoicesPage } from "./pages/DocumentsInvoices";
import { PortalMessagesPage, PortalApprovalsPage } from "./pages/MessagesApprovals";
import { PortalMorePage, PortalProfilePage } from "./pages/ProfileMore";
import "./portal.css";

function PortalGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = usePortal();
  if (loading) {
    return (
      <div className="cp-login">
        <div className="cp-card">Loading portal…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/portal/login" replace />;
  return <>{children}</>;
}

function PreviewRoute() {
  const { clientId = "" } = useParams();
  const [params] = useSearchParams();
  const asUid = params.get("as") || "";
  return (
    <PortalProvider previewClientId={clientId}>
      <div className="cp-shell">
        <div className="cp-top">
          <strong>Preview as {asUid || "contact"}</strong>
        </div>
        <main className="cp-main">
          <PortalHomePage />
        </main>
      </div>
    </PortalProvider>
  );
}

export function PortalApp() {
  const [boot, setBoot] = useState(true);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => setBoot(false));
    return unsub;
  }, []);
  if (boot) {
    return (
      <div className="cp-login">
        <div className="cp-card">Opening portal…</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PreviewRoute />} path="/portal/preview/:clientId/:projectId" />
        <Route
          element={
            <PortalProvider>
              <PortalLoginPage />
            </PortalProvider>
          }
          path="/portal/login"
        />
        <Route
          element={
            <PortalProvider>
              <PortalAuthPage />
            </PortalProvider>
          }
          path="/portal/auth"
        />
        <Route
          element={
            <PortalProvider>
              <PortalGate>
                <PortalShell />
              </PortalGate>
            </PortalProvider>
          }
          path="/portal"
        >
          <Route element={<PortalHomePage />} index />
          <Route element={<PortalProjectsPage />} path="projects" />
          <Route element={<PortalProjectPage />} path="projects/:projectId" />
          <Route element={<PortalRequestsPage />} path="requests" />
          <Route element={<PortalDocumentsPage />} path="documents" />
          <Route element={<PortalInvoicesPage />} path="invoices" />
          <Route element={<PortalMessagesPage />} path="messages" />
          <Route element={<PortalApprovalsPage />} path="approvals" />
          <Route element={<PortalProfilePage />} path="profile" />
          <Route element={<PortalMorePage />} path="more" />
        </Route>
        <Route element={<Navigate to="/portal" replace />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}

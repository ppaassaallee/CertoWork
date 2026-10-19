import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  limit,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import {
  ensurePortalClaims,
  getPortalClaims,
  loadPortalMember,
  touchPortalLastSeen,
} from "../lib/clientPortal/auth";
import type { PortalLocale, PortalMeta } from "../lib/clientPortal/types";
import { clientPortalRoot, PORTAL_SUB } from "../lib/clientPortal/collections";

type PortalCtx = {
  user: User | null;
  loading: boolean;
  clientId: string;
  clientIds: string[];
  locale: PortalLocale;
  setLocale: (l: PortalLocale) => void;
  member: Record<string, unknown> | null;
  meta: PortalMeta | null;
  brandName: string;
  logOut: () => Promise<void>;
  t: (key: string) => string;
};

const Ctx = createContext<PortalCtx | null>(null);

const STR: Record<PortalLocale, Record<string, string>> = {
  en: {
    home: "Home",
    projects: "Projects",
    requests: "Requests",
    invoices: "Invoices",
    documents: "Documents",
    messages: "Messages",
    more: "More",
    approvals: "Approvals",
    profile: "Profile",
    signOut: "Sign out",
    clientPortal: "Client portal",
    loginTitle: "Sign in to your portal",
    loginHint: "We'll email you a magic link. No password needed.",
    email: "Work email",
    sendLink: "Send magic link",
    linkSent: "Check your email for the sign-in link.",
    notInvited: "We couldn't find an invitation for that email.",
    revoked: "This portal access was revoked. Contact your project team.",
    greeting: "Hello",
    needsAction: "Needs your action",
    yourProjects: "Your projects",
    recent: "Recent",
    emptyProjects: "No projects are shared with you yet.",
    review: "Review",
    accept: "Accept",
    reject: "Reject",
    newRequest: "New request",
    requestIntro: "Get help from your project team and follow every update here.",
    requestSelectArea: "Service area",
    requestSelectKind: "What do you need?",
    requestKindRequest: "Request something",
    requestKindIncident: "Report a problem",
    requestKindFeedback: "Share feedback",
    requestTitle: "Short title",
    requestDescription: "Tell us what happened or what you need",
    requestTitlePlaceholder: "A sentence that describes your request",
    requestDescriptionPlaceholder: "Add the details your team needs to help you.",
    requestSubmit: "Send request",
    requestCancel: "Cancel",
    requestCreated: "Your request was received.",
    requestCreateFailed: "We couldn't send this request. Please try again.",
    requestNoAreas: "No service areas are published yet. Contact your project team.",
    requestEmpty: "You have no requests yet.",
    requestMyRequests: "Requests",
    requestDetail: "Request details",
    requestLatestUpdate: "Latest update",
    requestNextUpdate: "Next expected update",
    requestStatusReceived: "Received",
    requestStatusInProgress: "In progress",
    requestStatusWaitingYou: "Waiting on you",
    requestStatusWaitingTeam: "Waiting on the team",
    requestStatusResolved: "Resolved",
    requestStatusClosed: "Closed",
    requestBack: "Back to requests",
    requestSentOn: "Submitted",
    requestConversation: "Conversation",
    requestReply: "Reply to the team",
    requestReplyPlaceholder: "Add context or answer the team's question.",
    requestReplySent: "Your reply was sent.",
    requestReplyFailed: "We couldn't send your reply. Please try again.",
    requestNoConversation: "No messages yet.",
    askProject: "Ask about this project",
    askPlaceholder: "What do you need to know?",
    askSend: "Ask",
    overview: "Overview",
    updates: "Updates",
    timeline: "Timeline",
    download: "Download",
    approve: "Approve for payment",
    language: "Language",
    notifications: "Notifications",
    waitingOnYou: "Waiting on you",
    onTrack: "Everything else is on track.",
  },
  es: {
    home: "Inicio",
    projects: "Proyectos",
    requests: "Solicitudes",
    invoices: "Facturas",
    documents: "Documentos",
    messages: "Mensajes",
    more: "Más",
    approvals: "Aprobaciones",
    profile: "Perfil",
    signOut: "Salir",
    clientPortal: "Portal del cliente",
    loginTitle: "Entrá a tu portal",
    loginHint: "Te enviamos un enlace mágico. No necesitás contraseña.",
    email: "Correo de trabajo",
    sendLink: "Enviar enlace",
    linkSent: "Revisá tu correo para el enlace de acceso.",
    notInvited: "No encontramos una invitación para ese correo.",
    revoked: "Este acceso fue revocado. Contactá a tu equipo de proyecto.",
    greeting: "Hola",
    needsAction: "Necesita tu acción",
    yourProjects: "Tus proyectos",
    recent: "Reciente",
    emptyProjects: "Todavía no hay proyectos compartidos contigo.",
    review: "Revisar",
    accept: "Aceptar",
    reject: "Rechazar",
    newRequest: "Nueva solicitud",
    requestIntro: "Pide ayuda a tu equipo de proyecto y sigue cada actualización aquí.",
    requestSelectArea: "Área de servicio",
    requestSelectKind: "¿Qué necesitas?",
    requestKindRequest: "Solicitar algo",
    requestKindIncident: "Reportar un problema",
    requestKindFeedback: "Compartir un comentario",
    requestTitle: "Título breve",
    requestDescription: "Cuéntanos qué pasó o qué necesitas",
    requestTitlePlaceholder: "Una frase que describa tu solicitud",
    requestDescriptionPlaceholder: "Agrega los detalles que tu equipo necesita para ayudarte.",
    requestSubmit: "Enviar solicitud",
    requestCancel: "Cancelar",
    requestCreated: "Recibimos tu solicitud.",
    requestCreateFailed: "No pudimos enviar la solicitud. Intenta de nuevo.",
    requestNoAreas: "Todavía no hay áreas de servicio publicadas. Contacta a tu equipo de proyecto.",
    requestEmpty: "Todavía no tienes solicitudes.",
    requestMyRequests: "Solicitudes",
    requestDetail: "Detalle de la solicitud",
    requestLatestUpdate: "Última actualización",
    requestNextUpdate: "Próxima actualización esperada",
    requestStatusReceived: "Recibida",
    requestStatusInProgress: "En progreso",
    requestStatusWaitingYou: "Esperando tu respuesta",
    requestStatusWaitingTeam: "Esperando al equipo",
    requestStatusResolved: "Resuelta",
    requestStatusClosed: "Cerrada",
    requestBack: "Volver a solicitudes",
    requestSentOn: "Enviada",
    requestConversation: "Conversación",
    requestReply: "Responder al equipo",
    requestReplyPlaceholder: "Agrega contexto o responde la pregunta del equipo.",
    requestReplySent: "Tu respuesta fue enviada.",
    requestReplyFailed: "No pudimos enviar tu respuesta. Intenta de nuevo.",
    requestNoConversation: "Aún no hay mensajes.",
    askProject: "Preguntá por este proyecto",
    askPlaceholder: "¿Qué necesitás saber?",
    askSend: "Preguntar",
    overview: "Resumen",
    updates: "Actualizaciones",
    timeline: "Línea de tiempo",
    download: "Descargar",
    approve: "Aprobar para pago",
    language: "Idioma",
    notifications: "Notificaciones",
    waitingOnYou: "Esperando por ti",
    onTrack: "Todo lo demás va en curso.",
  },
};

export function PortalProvider({
  children,
  previewClientId,
}: {
  children: ReactNode;
  previewClientId?: string;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [member, setMember] = useState<Record<string, unknown> | null>(null);
  const [meta, setMeta] = useState<PortalMeta | null>(null);
  const [locale, setLocale] = useState<PortalLocale>("es");

  useEffect(() => {
    return onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (!next) {
        setClientIds([]);
        setMember(null);
        setLoading(false);
        return;
      }
      try {
        let claims = await getPortalClaims();
        if (!claims && !previewClientId) {
          await ensurePortalClaims().catch(() => null);
          claims = await getPortalClaims();
        }
        const ids = previewClientId
          ? [previewClientId]
          : claims?.clientIds || [];
        setClientIds(ids);
        const m = await loadPortalMember(next.uid);
        setMember(m);
        if (m?.locale === "en" || m?.locale === "es") setLocale(m.locale as PortalLocale);
        await touchPortalLastSeen(next.uid);
      } finally {
        setLoading(false);
      }
    });
  }, [previewClientId]);

  const clientId = previewClientId || clientIds[0] || "";

  useEffect(() => {
    if (!clientId) {
      setMeta(null);
      return;
    }
    return onSnapshot(doc(db, `${clientPortalRoot(clientId)}/${PORTAL_SUB.meta}/portal`), (snap) => {
      setMeta(snap.exists() ? (snap.data() as PortalMeta) : null);
    });
  }, [clientId]);

  const value = useMemo<PortalCtx>(
    () => ({
      user,
      loading,
      clientId,
      clientIds,
      locale,
      setLocale,
      member,
      meta,
      brandName: meta?.brand?.name || "Certo Work",
      logOut: () => signOut(auth),
      t: (key) => STR[locale][key] || STR.en[key] || key,
    }),
    [user, loading, clientId, clientIds, locale, member, meta],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePortal outside provider");
  return ctx;
}

export function usePortalCollection<T extends { id: string }>(
  sub: string,
  orderField?: string,
  max = 50,
) {
  const { clientId } = usePortal();
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    if (!clientId) {
      setRows([]);
      return;
    }
    const col = collection(db, `${clientPortalRoot(clientId)}/${sub}`);
    const q = orderField
      ? query(col, orderBy(orderField, "desc"), limit(max))
      : query(col, limit(max));
    return onSnapshot(
      q,
      (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)),
      () => setRows([]),
    );
  }, [clientId, sub, orderField, max]);
  return rows;
}

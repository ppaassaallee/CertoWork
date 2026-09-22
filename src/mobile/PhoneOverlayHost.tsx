import { useMemo, useState, useEffect } from "react";
import { PhoneAppChrome, phoneTabFromPath } from "./PhoneAppChrome";
import { MobileChromeProvider } from "./MobileChromeContext";
import { PhoneHome } from "./pages/PhoneHome";
import { PhoneMyWork } from "./pages/PhoneMyWork";
import { PhoneProjects } from "./pages/PhoneProjects";
import { PhoneProjectDetail } from "./pages/PhoneProjectDetail";
import { PhoneNotes } from "./pages/PhoneNotes";
import { PhoneInbox, type InboxConversation, type InboxRow } from "./pages/PhoneInbox";
import { PhoneConversation } from "./pages/PhoneConversation";
import { PhoneSearch } from "./pages/PhoneSearch";
import { CreateSheet, type CreateKind } from "./sheets/CreateSheet";
import { ProfileSheet } from "./sheets/ProfileSheet";
import { WorkspaceSheet } from "./sheets/WorkspaceSheet";
import { OdysseusSheet } from "./sheets/OdysseusSheet";
import { useDailyPlanEnabled } from "../features/dailyPlan";
import type { ReactNode } from "react";
import "./phone-shell.css";
import "./ui/mobile-ui.css";

export function PhoneOverlayHost({
  pathname,
  workspaceName,
  workspaceId,
  workspaces,
  userId,
  userName,
  userEmail,
  isAdmin,
  greeting,
  overdueCount,
  dueTodayCount,
  plannedCount,
  doneCount,
  keyTaskTitle,
  projects,
  notes,
  items,
  inboxRows,
  conversations,
  inboxBadge,
  myWorkList,
  dailyPlanSlot,
  tables,
  onNavigate,
  onOpenOdysseus,
  onOpenItem,
  onOpenProject,
  onOpenNote,
  onOpenConversation,
  onSwitchWorkspace,
  onSignOut,
  onCreate,
  onNotice,
}: {
  pathname: string;
  workspaceName: string;
  workspaceId?: string;
  workspaces: Array<{ id: string; name: string }>;
  userId?: string;
  userName: string;
  userEmail: string;
  isAdmin?: boolean;
  greeting: string;
  overdueCount: number;
  dueTodayCount: number;
  plannedCount: number;
  doneCount: number;
  keyTaskTitle?: string | null;
  projects: Array<{
    id: string;
    title: string;
    stage?: string;
    health?: string;
    owner?: string;
    nextCheckpoint?: unknown;
    updatedAt?: unknown;
  }>;
  tables?: Array<{ id: string; name: string; recordCount?: number; icon?: string }>;
  notes: Array<{
    id: string;
    title: string;
    visibility?: string;
    updatedAt?: unknown;
    projectId?: string | null;
  }>;
  items: Array<{
    id: string;
    title: string;
    status?: string;
    dueDate?: string | null;
    projectId?: string | null;
  }>;
  inboxRows: InboxRow[];
  conversations?: InboxConversation[];
  inboxBadge: number;
  myWorkList: () => ReactNode;
  dailyPlanSlot?: ReactNode;
  onNavigate: (to: string) => void;
  onOpenOdysseus: (prompt?: string) => void;
  onOpenItem: (id: string) => void;
  onOpenProject: (id: string) => void;
  onOpenNote: (id: string) => void;
  onOpenConversation?: (id: string) => void;
  onSwitchWorkspace: (id: string) => void;
  onSignOut: () => void;
  onCreate: (payload: {
    kind: CreateKind;
    title: string;
    description: string;
    createAnother: boolean;
  }) => void | Promise<void>;
  onNotice?: (msg: string) => void;
}) {
  const dailyOn = useDailyPlanEnabled();
  const tab = phoneTabFromPath(pathname);
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [odyOpen, setOdyOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const projectDetailId = useMemo(() => {
    const match = pathname.match(/^\/(?:work\/)?projects\/([^/]+)/);
    if (!match) return null;
    const id = decodeURIComponent(match[1]);
    if (!id || id === "health") return null;
    return id;
  }, [pathname]);

  const detailProject = useMemo(
    () => (projectDetailId ? projects.find((p) => p.id === projectDetailId) || null : null),
    [projectDetailId, projects],
  );

  const isProjectDetail = Boolean(projectDetailId);

  const createKind: CreateKind =
    isProjectDetail
      ? "item"
      : tab === "projects"
        ? "project"
        : tab === "notes"
          ? "note"
          : "item";

  const odysseusAnchor = useMemo(() => {
    if (projectDetailId && detailProject) return `Project · ${detailProject.title}`;
    if (tab === "my-work") return "My Work";
    if (tab === "projects") return "Projects · Overview";
    if (tab === "notes") return "Notes";
    if (tab === "inbox") return "Inbox";
    return "Home";
  }, [tab, projectDetailId, detailProject]);

  const suggestions = useMemo(() => {
    if (projectDetailId && detailProject)
      return [
        `What needs attention in ${detailProject.title}?`,
        "Summarize open items and risks",
      ];
    if (tab === "projects")
      return ["What needs attention in the portfolio?", "Which projects are at risk?"];
    if (tab === "my-work") return ["What's on fire?", "Move the extras to tomorrow"];
    return ["What should I focus on?", "Summarize my day"];
  }, [tab, projectDetailId, detailProject]);

  const attention = projects
    .filter((p) => /risk|block|overdue/i.test(String(p.health || "")))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      title: p.title,
      reason: p.health || "Needs attention",
    }));

  const kpis = [
    { label: "open", value: String(projects.length) },
    { label: "overdue items", value: String(overdueCount) },
  ];

  const isHome = tab === "home" && !pathname.startsWith("/settings");
  const isMyWork = tab === "my-work";
  const isProjects = tab === "projects" && !isProjectDetail;
  const isNotes = tab === "notes";
  const isInbox = tab === "inbox";
  const showPhonePage =
    isHome || isMyWork || isProjects || isProjectDetail || isNotes || isInbox;

  useEffect(() => {
    if (!isInbox) setActiveConversationId(null);
  }, [isInbox]);

  const inboxConversations = useMemo(() => {
    if (!Array.isArray(conversations)) return undefined;
    return conversations.map((c) => ({
      ...c,
      onOpen: () => {
        setActiveConversationId(c.id);
        onOpenConversation?.(c.id);
        c.onOpen?.();
      },
    }));
  }, [conversations, onOpenConversation]);

  const activeConversation = useMemo(
    () =>
      activeConversationId
        ? (conversations || []).find((c) => c.id === activeConversationId) || null
        : null,
    [activeConversationId, conversations],
  );

  const showConversation =
    Boolean(isInbox && activeConversationId && workspaceId && userId);

  return (
    <MobileChromeProvider>
      <div className="m-root m-phone-overlay" data-testid="phone-overlay">
        <PhoneAppChrome
          inboxBadge={inboxBadge}
          onMarkAllRead={() => onNotice?.("Marked read")}
          onNavigate={onNavigate}
          onOpenCreate={() => setCreateOpen(true)}
          onOpenMore={() => setOdyOpen(true)}
          onOpenOdysseus={() => setOdyOpen(true)}
          onOpenProfile={() => setProfileOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          pathname={pathname}
        />
        <div className="m-phone-main">
          {isHome ? (
            <PhoneHome
              dueTodayCount={dueTodayCount}
              doneCount={doneCount}
              greeting={greeting}
              keyTaskTitle={keyTaskTitle}
              onOpenOdysseus={() => setOdyOpen(true)}
              onOpenWorkspace={() => setWorkspaceOpen(true)}
              overdueCount={overdueCount}
              plannedCount={plannedCount}
              projects={projects}
              workspaceName={workspaceName}
            />
          ) : null}
          {isMyWork ? (
            dailyOn && dailyPlanSlot ? (
              <div className="m-phone-pad" style={{ paddingTop: 0 }}>
                {dailyPlanSlot}
              </div>
            ) : (
              <PhoneMyWork
                dailyPlanSlot={dailyPlanSlot}
                itemCount={items.length}
                listRenderer={myWorkList}
                overdueCount={overdueCount}
              />
            )
          ) : null}
          {isProjects ? (
            <PhoneProjects attention={attention} kpis={kpis} projects={projects} tables={tables} />
          ) : null}
          {isProjectDetail && projectDetailId ? (
            <PhoneProjectDetail
              items={items}
              notes={notes}
              onAskOdysseus={() =>
                setOdyOpen(true)
              }
              onOpenItem={onOpenItem}
              onOpenNote={onOpenNote}
              project={detailProject}
              projectId={projectDetailId}
            />
          ) : null}
          {isNotes ? (
            <PhoneNotes
              notes={notes}
              onCreate={() => setCreateOpen(true)}
              onOpen={onOpenNote}
            />
          ) : null}
          {isInbox && showConversation && activeConversationId && workspaceId && userId ? (
            <PhoneConversation
              conversationId={activeConversationId}
              onBack={() => setActiveConversationId(null)}
              title={activeConversation?.title}
              userId={userId}
              userName={userName}
              workspaceId={workspaceId}
            />
          ) : null}
          {isInbox && !showConversation ? (
            <PhoneInbox conversations={inboxConversations} rows={inboxRows} />
          ) : null}
          {!showPhonePage ? (
            <p className="m-caption" style={{ padding: 16 }}>
              Opened {pathname}. Use Profile for Settings and Conversations.
            </p>
          ) : null}
        </div>

        <CreateSheet
          defaultKind={createKind}
          onClose={() => setCreateOpen(false)}
          onCreate={async (payload) => {
            await onCreate(payload);
            onNotice?.(payload.createAnother ? "Created" : "Created · Open");
          }}
          open={createOpen}
        />
        <ProfileSheet
          email={userEmail}
          isAdmin={isAdmin}
          name={userName}
          onClose={() => setProfileOpen(false)}
          onNavigate={onNavigate}
          onSignOut={onSignOut}
          open={profileOpen}
          workspaceName={workspaceName}
        />
        <WorkspaceSheet
          currentId={workspaceId}
          onClose={() => setWorkspaceOpen(false)}
          onSwitch={onSwitchWorkspace}
          open={workspaceOpen}
          workspaces={workspaces}
        />
        <OdysseusSheet
          anchor={odysseusAnchor}
          onClose={() => setOdyOpen(false)}
          onSend={(prompt) => onOpenOdysseus(prompt)}
          open={odyOpen}
          suggestions={suggestions}
        />
        <PhoneSearch
          items={items}
          notes={notes}
          onClose={() => setSearchOpen(false)}
          onOpenItem={onOpenItem}
          onOpenNote={onOpenNote}
          onOpenProject={onOpenProject}
          open={searchOpen}
          projects={projects}
        />
      </div>
    </MobileChromeProvider>
  );
}

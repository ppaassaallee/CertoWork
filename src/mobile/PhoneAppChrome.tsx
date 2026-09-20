import { Folder, Home, Inbox, CheckSquare, FileText, Sparkles, Search, MoreHorizontal, User, Check } from "../components/ui/Icon";
import { MFab, MHeader, MIconButton, MTabBar, type MTabItem } from "./ui";
import { useMobileChrome } from "./MobileChromeContext";

export type PhoneTabId = "home" | "my-work" | "projects" | "inbox" | "notes";

export function phoneTabFromPath(pathname: string): PhoneTabId {
  if (pathname.startsWith("/my-work")) return "my-work";
  if (pathname.startsWith("/projects") || pathname.startsWith("/work")) return "projects";
  if (pathname === "/inbox" || pathname.startsWith("/inbox/")) return "inbox";
  if (pathname.startsWith("/notes")) return "notes";
  return "home";
}

const TABS: MTabItem[] = [
  { id: "home", label: "Home", to: "/home", icon: <Home size={20} /> },
  { id: "my-work", label: "My Work", to: "/my-work", icon: <CheckSquare size={20} /> },
  { id: "projects", label: "Projects", to: "/projects", icon: <Folder size={20} /> },
  { id: "inbox", label: "Inbox", to: "/inbox", icon: <Inbox size={20} /> },
  { id: "notes", label: "Notes", to: "/notes", icon: <FileText size={20} /> },
];

export function PhoneAppChrome({
  pathname,
  inboxBadge = 0,
  onNavigate,
  onOpenOdysseus,
  onOpenSearch,
  onOpenProfile,
  onOpenCreate,
  onMarkAllRead,
  onOpenMore,
}: {
  pathname: string;
  inboxBadge?: number;
  onNavigate: (to: string) => void;
  onOpenOdysseus: () => void;
  onOpenSearch: () => void;
  onOpenProfile: () => void;
  onOpenCreate: () => void;
  onMarkAllRead?: () => void;
  onOpenMore?: () => void;
}) {
  const { header, sheetOpen, keyboardUp } = useMobileChrome();
  const active = phoneTabFromPath(pathname);
  const tabs = TABS.map((t) =>
    t.id === "inbox" ? { ...t, badge: inboxBadge } : t,
  );

  const actions = (() => {
    if (header.actions) return header.actions;
    if (active === "home") {
      return (
        <>
          <MIconButton label="Odysseus" onClick={onOpenOdysseus}>
            <Sparkles size={20} />
          </MIconButton>
          <MIconButton label="Search" onClick={onOpenSearch}>
            <Search size={20} />
          </MIconButton>
          <MIconButton label="Profile" onClick={onOpenProfile}>
            <User size={20} />
          </MIconButton>
        </>
      );
    }
    if (active === "my-work") {
      return (
        <>
          <MIconButton label="Odysseus" onClick={onOpenOdysseus}>
            <Sparkles size={20} />
          </MIconButton>
          <MIconButton label="More" onClick={onOpenMore}>
            <MoreHorizontal size={20} />
          </MIconButton>
        </>
      );
    }
    if (active === "projects") {
      return (
        <>
          <MIconButton label="Odysseus" onClick={onOpenOdysseus}>
            <Sparkles size={20} />
          </MIconButton>
          <MIconButton label="Search" onClick={onOpenSearch}>
            <Search size={20} />
          </MIconButton>
          <MIconButton label="More" onClick={onOpenMore}>
            <MoreHorizontal size={20} />
          </MIconButton>
        </>
      );
    }
    if (active === "inbox") {
      return (
        <>
          <MIconButton label="Mark all read" onClick={onMarkAllRead}>
            <Check size={20} />
          </MIconButton>
          <MIconButton label="More" onClick={onOpenMore}>
            <MoreHorizontal size={20} />
          </MIconButton>
        </>
      );
    }
    return (
      <>
        <MIconButton label="Search" onClick={onOpenSearch}>
          <Search size={20} />
        </MIconButton>
        <MIconButton label="More" onClick={onOpenMore}>
          <MoreHorizontal size={20} />
        </MIconButton>
      </>
    );
  })();

  return (
    <div className="m-phone-chrome" data-testid="phone-app-chrome">
      <MHeader
        actions={actions}
        onSubtitleClick={header.onSubtitleClick}
        subtitle={header.subtitle}
        title={header.title}
      />
      <MFab hidden={sheetOpen || keyboardUp} onClick={onOpenCreate} />
      <MTabBar activeId={active} items={tabs} onNavigate={onNavigate} />
    </div>
  );
}

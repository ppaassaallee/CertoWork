import { useState } from "react";
import { Folder, Home, Inbox, FileText, Sparkles, Search, User } from "../components/ui/Icon";
import {
  MButton,
  MChip,
  MEmpty,
  MFab,
  MHeader,
  MIconButton,
  MListRow,
  MSectionHeader,
  MSegmented,
  MSheet,
  MTabBar,
} from "./ui";

/** Dev-only kit preview — /dev/mobile-kit */
export function MobileKitPreview() {
  const [seg, setSeg] = useState("a");
  const [sheet, setSheet] = useState(false);
  return (
    <div className="m-root" style={{ maxWidth: 420, margin: "0 auto", minHeight: "100vh", background: "var(--c-bg)" }}>
      <MHeader
        actions={
          <>
            <MIconButton label="Odysseus">
              <Sparkles size={20} />
            </MIconButton>
            <MIconButton badge={3} label="Search">
              <Search size={20} />
            </MIconButton>
            <MIconButton label="Profile">
              <User size={20} />
            </MIconButton>
          </>
        }
        subtitle="Workspace ▾"
        title="Sunday 20 Sep"
      />
      <div className="m-phone-pad">
        <MSegmented
          onChange={setSeg}
          options={[
            { id: "a", label: "Today" },
            { id: "b", label: "My items" },
            { id: "c", label: "Events" },
          ]}
          value={seg}
        />
        <div className="m-chip-row">
          <MChip chevron selected>
            View
          </MChip>
          <MChip count={2}>Filter & sort</MChip>
          <MChip>Group: Project</MChip>
        </div>
        <MSectionHeader count={3} title="Banrural" />
        <MListRow
          leading={<input readOnly type="checkbox" />}
          meta={<span style={{ color: "#e0433a" }}>Sep 18</span>}
          statusDot="y"
          title="Tech addendum for Banrural"
        />
        <MListRow
          subtitle="Oct 1 · in 11 days"
          title="Pure AI"
          twoLine
          statusDot="g"
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <MButton onClick={() => setSheet(true)}>Primary</MButton>
          <MButton variant="secondary">Secondary</MButton>
          <MButton variant="ghost">Ghost</MButton>
          <MButton variant="danger">Danger</MButton>
        </div>
        <MEmpty title="No notes yet. Tap + to write one." />
      </div>
      <MFab onClick={() => setSheet(true)} />
      <MTabBar
        activeId="home"
        items={[
          { id: "home", label: "Home", to: "/", icon: <Home size={20} /> },
          { id: "my-work", label: "My Work", to: "/my-work", icon: <Inbox size={20} /> },
          { id: "projects", label: "Projects", to: "/projects", icon: <Folder size={20} /> },
          { id: "inbox", label: "Inbox", to: "/inbox", icon: <Inbox size={20} />, badge: 2 },
          { id: "notes", label: "Notes", to: "/notes", icon: <FileText size={20} /> },
        ]}
        onNavigate={() => undefined}
      />
      <MSheet
        footer={<MButton full>Create item</MButton>}
        onClose={() => setSheet(false)}
        open={sheet}
        title="Create"
      >
        <p>Sheet body with sticky footer above the keyboard.</p>
      </MSheet>
    </div>
  );
}

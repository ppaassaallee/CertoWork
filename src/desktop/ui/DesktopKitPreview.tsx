import { useState } from "react";
import {
  DAvatar,
  DAvatarStack,
  DButton,
  DChip,
  DIconButton,
  DPill,
  DPopover,
  DSegmented,
  DSheet,
  DStatCard,
  DTable,
  DTabs,
} from "./index";

export function DesktopKitPreview() {
  const [seg, setSeg] = useState("a");
  const [tab, setTab] = useState("list");
  const [sheet, setSheet] = useState(false);
  return (
    <div className="d-root" style={{ padding: 24, background: "var(--c-wash)", minHeight: "100vh" }}>
      <h1>Desktop kit</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <DButton onClick={() => setSheet(true)}>Primary</DButton>
        <DButton variant="secondary">Secondary</DButton>
        <DButton variant="ghost">Ghost</DButton>
        <DButton variant="danger">Danger</DButton>
        <DIconButton label="More">⋯</DIconButton>
      </div>
      <DSegmented
        onChange={setSeg}
        options={[
          { id: "a", label: "All" },
          { id: "b", label: "Pending" },
        ]}
        value={seg}
      />
      <div style={{ marginTop: 12 }}>
        <DTabs
          onChange={setTab}
          options={[
            { id: "list", label: "List" },
            { id: "board", label: "Board" },
            { id: "add", label: "+ View" },
          ]}
          value={tab}
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <DPill tone="overdue">Overdue · 33d</DPill>
        <DPill tone="paid">Paid · Sep 3</DPill>
        <DPill tone="pending">Pending</DPill>
        <DChip>Banrural</DChip>
        <DAvatarStack labels={["Alejandro Pascual", "Isaac", "Maya"]} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 16 }}>
        <DStatCard label="Planned today" value={5} />
        <DStatCard bad label="Overdue" value={31} />
        <DStatCard label="Focus" value="72" />
        <DStatCard label="Blocked" value={2} />
      </div>
      {tab === "add" ? (
        <div style={{ position: "relative", marginTop: 16 }}>
          <DPopover>
            <strong>Add a new view</strong>
            <p style={{ color: "var(--c-ink-2)", fontSize: 13 }}>List · Board · Calendar · Chart</p>
          </DPopover>
        </div>
      ) : null}
      <DSheet footer={<DButton>Save</DButton>} onClose={() => setSheet(false)} open={sheet} title="Example sheet">
        Sheet body
      </DSheet>
      <DAvatar label="AP" />
      <div style={{ marginTop: 20 }}>
        <DTable
          columns={[
            { id: "num", label: "Invoice" },
            { id: "amt", label: "Amount", numeric: true },
          ]}
          rows={[
            { id: "1", cells: { num: "INV-0231", amt: "$4,200" } },
            { id: "2", cells: { num: "INV-0232", amt: "$1,100" } },
          ]}
          selected={new Set()}
          onToggle={() => undefined}
        />
      </div>
    </div>
  );
}

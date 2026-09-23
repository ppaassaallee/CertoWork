import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { hasConfirmedSnapshotData } from "../../lib/firestoreSnapshotSafety";
import type { TableDoc } from "../../lib/tables";
import { useTablesEnabled } from "../flags/featureUserFlags";

/** Desktop Workspace › Tables list (flag-gated). */
export function TablesSidebarSection(props: {
  workspaceId: string;
  onOpenTable(id: string): void;
  onNewTable(): void;
}) {
  const enabled = useTablesEnabled();
  const [tables, setTables] = useState<TableDoc[]>([]);

  useEffect(() => {
    if (!enabled) return;
    setTables([]);
    const q = query(
      collection(db, "tables"),
      where("workspaceId", "==", props.workspaceId),
      orderBy("updatedAt", "desc"),
    );
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        if (!hasConfirmedSnapshotData(snap)) return;
        setTables(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<TableDoc, "id">) }))
            .filter((t) => t.status !== "deleted"),
        );
      },
      (error) => console.error(`Workspace ${props.workspaceId} tables could not be refreshed`, error),
    );
  }, [enabled, props.workspaceId]);

  if (!enabled) return null;

  const favorites = tables.filter((t) => t.favorite);
  const rest = tables.filter((t) => !t.favorite);

  return (
    <section className="cw-tables-sidebar" data-testid="tables-sidebar">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px" }}>
        <strong style={{ fontSize: 12, color: "#6B7280", letterSpacing: 0.4 }}>TABLES</strong>
        <button
          type="button"
          onClick={props.onNewTable}
          style={{ border: "none", background: "transparent", color: "#2547C4", cursor: "pointer", fontSize: 16 }}
          aria-label="New table"
        >
          +
        </button>
      </div>
      {[...favorites, ...rest].map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => props.onOpenTable(t.id)}
          style={{
            display: "flex",
            width: "100%",
            gap: 8,
            alignItems: "center",
            padding: "8px 12px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
            color: "#1F2430",
            fontSize: 13,
          }}
        >
          <span aria-hidden>{t.icon || "▦"}</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
          <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "ui-monospace, monospace" }}>{t.recordCount || 0}</span>
        </button>
      ))}
    </section>
  );
}

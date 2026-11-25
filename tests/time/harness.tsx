import React from "react";
import { createRoot } from "react-dom/client";
import TimeWorkspace from "../../src/features/time/TimeWorkspace";
import { civilDate, weekDates, type TimeEntry, type TimeSheet } from "../../src/features/time/model";
import { setLocale } from "../../src/lib/localeStore";
import { type Timer, type timeStore } from "../../src/lib/time/storage";
let rows: TimeEntry[] = [];
let sheets: TimeSheet[] = [];
let timer: Timer | null = null;
if (new URLSearchParams(window.location.search).has("report-fixture")) {
  sheets = [{ id: "legal", name: "Legal review" }];
  const days = weekDates(civilDate());
  rows = Array.from({ length: 100 }, (_, index) => ({ id: `report-${index}`, workspaceId: "test", userId: "me", sheetId: index < 50 ? "default" : "legal", projectId: "p", itemId: "i", date: days[index % 7], minutes: 30, billable: index % 2 === 0, description: `Review ${index + 1}: Revisión técnica - análisis de contratos y documentación de ingeniería. ` + "Delivery notes and client context. ".repeat(4) }));
}
const repository: ReturnType<typeof timeStore> = {
  async loadWeek(first, last) {
    return {
      rows: rows.filter((row) => row.date >= first && row.date <= last),
      cursor: undefined,
      more: false,
    };
  },
  async sheets() {
    return sheets;
  },
  async addSheet(name) {
    const id = crypto.randomUUID();
    sheets = [...sheets, { id, name }];
    return id;
  },
  async save(row) {
    rows = [...rows.filter((value) => value.id !== row.id), row];
  },
  async saveMany(entries) {
    for (const row of entries) rows = [...rows.filter((value) => value.id !== row.id), row];
  },
  async remove(id) {
    rows = rows.filter((row) => row.id !== id);
  },
  async timer() {
    return timer;
  },
  async start(value) {
    timer = { ...value, date: civilDate(), startedAtMs: Date.now() };
    return timer;
  },
  async stop() {
    if (timer) {
      const { startedAtMs: _started, ...value } = timer;
      void _started;
      const row = { ...value, id: crypto.randomUUID(), minutes: 1 };
      rows.push(row);
      timer = null;
      return row;
    }
    return null;
  },
  async discardTimer() {
    timer = null;
  },
};
setLocale("en");
createRoot(document.getElementById("root")!).render(
  <>
    <nav>
      <button onClick={() => setLocale("en")}>English</button>
      <button onClick={() => setLocale("es")}>Español</button>
    </nav>
    <TimeWorkspace
      workspaceId="test"
      userId="me"
      person="Ana Martínez"
      workspaceName="Certo Studio"
      projects={[{ id: "p", title: "Certo engineering" }]}
      items={[
        {
          id: "i",
          title: "Build time tracking",
          projectId: "p",
          workItemType: "pbi",
        },
      ]}
      repository={repository}
    />
  </>,
);

import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkloadRows } from "../src/lib/workload";

const NOW = new Date("2026-09-16T15:00:00.000Z");
const WS = "BZWdZExcupV1EuBrJysG";
const UID_A = "2duHALPBnsgbFpzO1j4XA0SdqCt2";
const UID_B = "tM5YWn1u7MbHTDWu6Rhhe80V6j33";

test("resolves workspace member ids to display names", () => {
  const rows = buildWorkloadRows({
    now: NOW,
    members: [
      {
        id: `${WS}_${UID_A}`,
        userId: UID_A,
        displayName: "Alejandro Pascual",
      },
      {
        id: `${WS}_${UID_B}`,
        userId: UID_B,
        displayName: "Regina Guardia",
      },
    ],
    projects: [{ id: "p1", title: "General" }],
    tasks: [
      {
        id: "t1",
        title: "Owned by member id",
        status: "open",
        dueDate: "2026-09-10",
        assigneeIds: [`${WS}_${UID_A}`],
        owner: "Alejandro Pascual",
      },
      {
        id: "t2",
        title: "Regina item",
        status: "open",
        dueDate: "2026-09-11",
        assigneeId: `${WS}_${UID_B}`,
      },
    ],
  });

  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => !row.assigneeName.includes(WS)));
  assert.ok(rows.some((row) => row.assigneeName === "Alejandro Pascual"));
  assert.ok(rows.some((row) => row.assigneeName === "Regina Guardia"));
});

test("does not duplicate the same person under id + owner label", () => {
  const rows = buildWorkloadRows({
    now: NOW,
    members: [
      {
        id: `${WS}_${UID_A}`,
        userId: UID_A,
        displayName: "Alejandro Pascual",
      },
    ],
    projects: [],
    tasks: [
      {
        id: "t1",
        title: "One task",
        status: "open",
        dueDate: "2026-09-01",
        assigneeIds: [`${WS}_${UID_A}`],
        assigneeId: `${WS}_${UID_A}`,
        owner: "Alejandro Pascual",
        ownerId: UID_A,
      },
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.itemCount, 1);
  assert.equal(rows[0]?.assigneeName, "Alejandro Pascual");
});

test("uses 1h per item when estimates are missing", () => {
  const rows = buildWorkloadRows({
    now: NOW,
    members: [{ id: `${WS}_${UID_A}`, userId: UID_A, displayName: "Alejandro" }],
    projects: [],
    tasks: [
      {
        id: "t1",
        title: "A",
        status: "open",
        dueDate: "2026-09-01",
        assigneeIds: [`${WS}_${UID_A}`],
      },
      {
        id: "t2",
        title: "B",
        status: "open",
        dueDate: "2026-09-02",
        assigneeIds: [`${WS}_${UID_A}`],
      },
    ],
  });

  assert.equal(rows[0]?.estimateHours, 2);
  assert.ok((rows[0]?.loadRatio || 0) > 0);
});

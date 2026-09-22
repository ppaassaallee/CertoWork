import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDirectionData,
  formatDirectionMoney,
} from "../src/features/direction/buildDirectionData";

const NOW = new Date("2026-09-16T15:00:00.000Z");

test("excludes deleted and archived projects from attention", () => {
  const data = buildDirectionData({
    now: NOW,
    projects: [
      {
        id: "p_deleted",
        title: "Gone",
        status: "deleted",
        health: "blocked",
      },
      {
        id: "p_archived",
        title: "Old",
        status: "archived",
        health: "at_risk",
      },
      {
        id: "p_active",
        title: "Speech Analytics",
        status: "active",
        health: "blocked",
      },
    ],
    tasks: [
      { id: "t1", projectId: "p_active", status: "blocked", title: "Blocked item" },
    ],
  });
  assert.equal(data.projectsAttention.length, 1);
  assert.equal(data.projectsAttention[0]?.projectId, "p_active");
  assert.doesNotMatch(
    data.projectsAttention.map((row) => row.name).join(" "),
    /Gone|Old/,
  );
});

test("counts unassigned overdue as Sin dueño", () => {
  const data = buildDirectionData({
    now: NOW,
    locale: "es",
    unassignedLabel: "Sin dueño",
    tasks: [
      {
        id: "a",
        title: "No owner",
        status: "open",
        dueDate: "2026-09-01",
      },
      {
        id: "b",
        title: "Also open",
        status: "open",
        dueDate: "2026-09-10",
      },
      {
        id: "c",
        title: "Owned",
        status: "open",
        dueDate: "2026-09-01",
        assigneeId: "u_regina",
      },
    ],
    members: [{ userId: "u_regina", displayName: "Regina" }],
  });
  const none = data.overdueByOwner.find((row) => row.userId === null);
  assert.ok(none);
  assert.equal(none?.name, "Sin dueño");
  assert.equal(none?.count, 2);
  assert.ok((none?.oldestDays || 0) >= 15);
});

test("marginPct is null when costs are missing", () => {
  const data = buildDirectionData({
    now: NOW,
    projects: [
      {
        id: "p1",
        title: "Billable",
        status: "active",
        financePeriods: [
          {
            id: "per1",
            kind: "monthly",
            year: 2026,
            month: 9,
            status: "active",
            currency: "USD",
            label: "Sep",
            entries: [
              {
                id: "e1",
                direction: "revenue",
                description: "Fee",
                category: "revenue",
                unit: "month",
                plannedQty: 1,
                actualQty: 1,
                rate: 10000,
                plannedRate: 10000,
                priceRate: 10000,
                plannedPriceRate: 10000,
                accountingMonth: "2026-09",
                invoiceStatus: "invoiced",
                financialStatus: "billed",
                referenceNumber: "INV-1",
              },
            ],
          },
        ],
      },
    ],
  });
  assert.ok(data.money.invoiced > 0);
  assert.equal(data.money.marginPct, null);
});

test("workload sorts by ratio descending and caps at 6", () => {
  const members = Array.from({ length: 8 }, (_, index) => ({
    userId: `u_${index}`,
    displayName: `Person ${index}`,
  }));
  const tasks = members.map((member, index) => ({
    id: `t_${index}`,
    title: `Task ${index}`,
    status: "open",
    assigneeId: member.userId,
    dueDate: "2026-09-17",
    estimateHours: (8 - index) * 10,
  }));
  const data = buildDirectionData({
    now: NOW,
    members,
    tasks,
    projects: [{ id: "p", title: "P", status: "active" }],
  });
  assert.ok(data.workload.length <= 6);
  for (let i = 1; i < data.workload.length; i += 1) {
    assert.ok(data.workload[i - 1].ratio >= data.workload[i].ratio);
  }
  assert.equal(data.workload[0]?.userId, "u_0");
});

test("never returns raw descriptions in list rows", () => {
  const long =
    "This is a very long consulting selective paragraph about Epic 1.1 that must never appear as a widget row body dump.";
  const data = buildDirectionData({
    now: NOW,
    locale: "en",
    tasks: [
      {
        id: "t1",
        title: "Access review",
        description: long,
        status: "open",
        dueDate: "2026-08-01",
        assigneeId: "u1",
      },
    ],
    members: [{ userId: "u1", displayName: "Alex" }],
    requests: [
      {
        id: "r1",
        title: "VPN access",
        description: long,
        ticketStatus: "waiting",
        createdAt: "2026-09-10T00:00:00.000Z",
      },
    ],
  });
  const blob = JSON.stringify(data);
  assert.doesNotMatch(blob, /consulting selective paragraph/);
  assert.doesNotMatch(blob, /widget row body dump/);
  assert.ok(data.overdueByOwner[0]?.name === "Alex");
  assert.equal(data.requests.top[0]?.title, "VPN access");
});

test("formatDirectionMoney uses compact k notation", () => {
  assert.equal(formatDirectionMoney(12400), "$12.4k");
  assert.equal(formatDirectionMoney(27800), "$27.8k");
});

test("resolves composite workspace member ids on workload and overdue", () => {
  const ws = "BZWdZExcupV1EuBrJysG";
  const uid = "2duHALPBnsgbFpzO1j4XA0SdqCt2";
  const memberId = `${ws}_${uid}`;
  const data = buildDirectionData({
    now: NOW,
    members: [
      {
        id: memberId,
        userId: uid,
        displayName: "Alejandro Pascual",
      },
    ],
    tasks: [
      {
        id: "t1",
        title: "Overdue for Alejandro",
        status: "open",
        dueDate: "2026-09-01",
        assigneeIds: [memberId],
        owner: "Alejandro Pascual",
      },
    ],
  });
  assert.equal(data.overdueByOwner.length, 1);
  assert.equal(data.overdueByOwner[0]?.name, "Alejandro Pascual");
  assert.doesNotMatch(data.overdueByOwner[0]?.name || "", /BZWd/);
  assert.equal(data.workload.length, 1);
  assert.equal(data.workload[0]?.name, "Alejandro Pascual");
  assert.ok((data.workload[0]?.hoursOpen || 0) > 0);
});

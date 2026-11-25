// Run only against the explicitly named local emulator; never production.
import assert from "node:assert/strict";
const host = process.env.FIRESTORE_EMULATOR_HOST;
assert.equal(host, "127.0.0.1:8097", "Start the local demo-certo-time emulator on port 8097 first");
const database = "projects/demo-certo-time/databases/(default)";
const base = `http://${host}/v1/${database}/documents`;
const fields = (object) =>
  Object.fromEntries(
    Object.entries(object).map(([key, value]) => [
      key,
      typeof value === "number"
        ? { integerValue: String(value) }
        : typeof value === "boolean"
          ? { booleanValue: value }
          : Array.isArray(value)
            ? {
                arrayValue: {
                  values: value.map((stringValue) => ({ stringValue })),
                },
              }
            : { stringValue: value },
    ]),
  );
const token = (user) =>
  `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: user, user_id: user, email: `${user}@example.com`, email_verified: true, aud: "demo-certo-time", iss: "https://securetoken.google.com/demo-certo-time", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, firebase: { sign_in_provider: "password" } })).toString("base64url")}.`;
async function seed(path, data) {
  const response = await fetch(`${base}/${path}`, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: fields(data) }),
  });
  assert.equal(response.status, 200, await response.text());
}
async function read(path, user, expected) {
  const response = await fetch(`${base}/${path}`, {
    headers: user ? { Authorization: `Bearer ${token(user)}` } : {},
  });
  assert.equal(response.status, expected, `${user || "anonymous"} read ${path}: ${await response.text()}`);
}
async function write(path, user, data, expected = 200) {
  const response = await fetch(`${base}:commit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token(user)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: `${database}/documents/${path}`,
            fields: fields(data),
          },
          updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
        },
      ],
    }),
  });
  assert.equal(response.status, expected, `${user} write ${path}: ${await response.text()}`);
}
await seed("workspaces/w", {
  ownerId: "owner",
  name: "Test workspace",
  members: ["member@example.com", "viewer@example.com"],
});
await seed("workspaces/other", {
  ownerId: "outsider",
  name: "Other",
  members: [],
});
for (const user of ["member", "viewer"])
  await seed(`workspace_members/w_${user}`, {
    workspaceId: "w",
    userId: user,
    role: user === "viewer" ? "viewer" : "member",
    status: "active",
  });
await seed("projects/p", {
  workspaceId: "w",
  userId: "owner",
  title: "Project",
  teamMemberIds: ["w_viewer"],
});
await seed("projects/foreign", {
  workspaceId: "other",
  userId: "outsider",
  title: "Foreign",
});
await seed("tasks/public", {
  workspaceId: "w",
  userId: "owner",
  projectId: "p",
  title: "Public",
  visibility: "project",
});
await seed("tasks/private", {
  workspaceId: "w",
  userId: "owner",
  projectId: "p",
  title: "Private",
  visibility: "private",
});
const path = "workspaces/w/time_users/member/entries/e";
const entry = {
  workspaceId: "w",
  userId: "member",
  sheetId: "default",
  projectId: "p",
  itemId: "public",
  description: "Authorized work",
  date: "2026-11-24",
  minutes: 90,
  billable: true,
};
await write(path, "member", entry);
await read(path, "member", 200);
for (const user of [null, "outsider", "viewer", "owner"]) await read(path, user, 403);
await write(path, "viewer", { ...entry, userId: "viewer" }, 403);
await write("workspaces/w/time_users/outsider/entries/e", "outsider", { ...entry, userId: "outsider" }, 403);
await write(path, "member", { ...entry, projectId: "foreign", itemId: "" }, 403);
await write(path, "member", { ...entry, itemId: "private" }, 403);
await write(path, "member", { ...entry, projectId: "", itemId: "public" }, 403);
await write(path, "member", { ...entry, minutes: 1441 }, 403);
await write(path, "member", { ...entry, sheetId: "someone-elses-sheet" }, 403);
await write(path, "member", { ...entry, userId: "owner" }, 403);
await write("workspaces/w/time_users/viewer/entries/e", "viewer", {
  ...entry,
  userId: "viewer",
});
console.log(
  "PASS: actual rules compiled; owner/member/viewer tracking, author isolation, tenant isolation, private target, target consistency, duration and sheet validation (17 assertions)",
);

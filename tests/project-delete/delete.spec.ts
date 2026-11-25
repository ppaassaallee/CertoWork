import { test, expect } from "@playwright/test";
const storageStub = `
const template={id:"trash",workspaceId:"fixture",surface:"projects-list",name:"Deleted projects",scope:"personal",ownerId:"me",layout:"list",columns:[{id:"title"},{id:"status"}],quickActions:[],filters:[{columnId:"status",op:"eq",value:"deleted"}],sort:[],groupBy:null,density:"comfortable",createdAt:"2026-11-24",updatedAt:"2026-11-24"};
export async function listViews(){return JSON.parse(localStorage.getItem("fixture-views")||"null")||[template]}
export async function createView(value){const result={...value,id:crypto.randomUUID(),isDefault:false};const all=await listViews();localStorage.setItem("fixture-views",JSON.stringify([...all,result]));return result}
export async function updateView(id,patch){const all=await listViews();const next=all.map(row=>row.id===id?{...row,...patch}:row);localStorage.setItem("fixture-views",JSON.stringify(next));return next.find(row=>row.id===id)}
export async function deleteView(){}
export function nextPersonalViewName(){return "My view"}
export async function persistDefaultCopy(value){return createView(value)}
export function getLastUsedViewId(){return localStorage.getItem("fixture-last-view")}
export async function setLastUsedView(user,surface,id){localStorage.setItem("fixture-last-view",id)}
`;
test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/.*(googleapis|firebaseio)\.com/, (route) => route.abort());
  await page.route(/\/src\/lib\/views\/storage\.ts(?:\?|$)/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: storageStub }),
  );
  await page.goto("/tests/project-delete/harness.html");
});
test("default and Clear all hide deleted; acknowledged soft deletion stays removed on refresh; restore works", async ({
  page,
}) => {
  const list = page.getByTestId("projects-asana-list");
  await expect(list).toContainText("Live project");
  await expect(list).not.toContainText("Deleted project");
  await expect(list).not.toContainText("Tombstone project");
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(list).toContainText("Completed project");
  await expect(list).not.toContainText("Deleted project");
  await expect(list).not.toContainText("Tombstone project");
  await page.getByRole("button", { name: "Move fixture to Deleted", exact: true }).click();
  await expect(list).not.toContainText("Live project");
  await page.reload();
  await expect(list).not.toContainText("Live project");
  await page.getByRole("button", { name: "Restore fixture project" }).click();
  await expect(list).toContainText("Live project");
});
test("saved Deleted view is explicit and Default exits trash", async ({ page }) => {
  const list = page.getByTestId("projects-asana-list");
  await page.getByRole("tab", { name: "Deleted projects", exact: true }).click();
  await expect(list).toContainText("Deleted project");
  await expect(list).toContainText("Tombstone project");
  await expect(list.getByTestId("projects-asana-row").filter({ hasText: "Tombstone project" })).toContainText("Deleted");
  await expect(list).not.toContainText("Live project");
  await page.getByRole("tab", { name: "Default", exact: true }).click();
  await expect(list).toContainText("Live project");
  await expect(list).not.toContainText("Deleted project");
});
test("a rejected write never claims to have deleted a project", async ({ page }) => {
  const list = page.getByTestId("projects-asana-list");
  await page.getByLabel("Reject fixture writes").check();
  await list.getByTestId("projects-row-select").first().click();
  const status = page.getByLabel("Bulk project status");
  await status.selectOption("archived");
  await status.locator("..").getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByTestId("project-bulk-feedback")).toContainText("failed");
  await expect(list).toContainText("Live project");
});

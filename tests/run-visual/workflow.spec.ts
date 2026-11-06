import {test,expect} from "@playwright/test";
const fixture={workspace_id:"pure",world:"Pure AI",items:[],control:{proposals:[{id:"proposal-1",itemTitle:"Prepare client proposal",action:"retitle",value:"Deliver reviewed proposal to client",reason:"The source identifies the final deliverable.",evidenceSourceId:"mail:123",status:"pending"}],briefs:[{date:"2026-11-06",kind:"morning",body:"Review the client proposal.\nConfirm the delivery scope before proceeding.",recordedAt:"2026-11-06T13:00:00Z",sourceIds:["mail:123"]}],sync:{revision:1,state:{last_run_at:"2026-11-06T13:00:00Z"},logs:[{at:"2026-11-06T13:00:00Z",summary:"One source reviewed. No outgoing messages sent.",failed_sources:["Outlook"]}]}}};
test.beforeEach(async({page})=>{await page.route("**/__agent_fixture",route=>route.fulfill({json:fixture}));});
test("brief, proposal review and bilingual copy use the real panel",async({page})=>{
  const writes:unknown[]=[];
  await page.route("**/api/run/agent/review",route=>{writes.push(route.request().postDataJSON());return route.fulfill({json:{status:"approved"}});});
  await page.goto("/tests/run-visual/agent-harness.html");
  await expect(page.getByRole("heading",{name:"Daily brief"})).toBeVisible();
  await expect(page.getByText("Review the client proposal.",{exact:false})).toBeVisible();
  await page.getByRole("button",{name:"Review proposals →",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Prepare client proposal"})).toBeVisible();
  await page.getByRole("button",{name:"Español"}).click();
  await expect(page.getByRole("button",{name:"Aprobar",exact:true})).toBeVisible();
  expect((await page.getByRole("region",{name:"Novedades de tu asistente"}).boundingBox())!.width).toBeGreaterThan(900);
  await page.screenshot({path:"test-results/run-workflow/proposal-es.png",fullPage:true});
  await page.getByRole("button",{name:"Aprobar",exact:true}).click();
  await expect(page.getByText("No hay propuestas pendientes de revisión.")).toBeVisible();
  expect(writes).toEqual([{workspace_id:"pure",world:"Pure AI",proposal_id:"proposal-1",decision:"approve"}]);
});
test("failed approval remains visible for review and mobile does not overflow",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route("**/api/run/agent/review",route=>route.fulfill({status:409,json:{message:"Item changed since the proposal."}}));
  await page.goto("/tests/run-visual/agent-harness.html");
  await page.getByRole("button",{name:"Decide",exact:true}).click();
  await page.getByRole("button",{name:"Approve",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("Item changed");
  await expect(page.getByRole("heading",{name:"Prepare client proposal"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

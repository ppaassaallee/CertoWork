import {test,expect} from "@playwright/test";
const rows=Array.from({length:28},(_,i)=>({id:`row-${i}`,workspaceId:"visual-workspace",runWorld:"Pure AI",runDecision:"make",runLane:"projects",status:"open",title:i===0?"Prepare the client proposal":`Review delivery milestone ${i}`,priority:i===0?"P1":"P3",epic:"Client launch",runContext:"Client context stays exactly as written.\nA second line with evidence.",runNextStep:"Confirm the delivery scope",runDeliverable:"A reviewed proposal",runDoneWhen:"The client accepts the scope",dueDate:"2026-11-12",assigneeName:"Alex"}));
test.beforeEach(async({page})=>{
  await page.clock.setFixedTime(new Date("2026-11-09T16:00:00Z"));
  await page.route("**/__run_ux_fixture",route=>route.fulfill({json:rows}));
  await page.route(/https:\/\/(firestore|identitytoolkit|securetoken)\.googleapis\.com\/.*/,route=>route.abort());
});
test("compact queue opens a scrollable drawer, closes with Escape and restores focus",async({page})=>{
  await page.goto("/tests/run-visual/ux-harness.html");
  await page.screenshot({path:"test-results/run-ux/desktop-queue.png",animations:"disabled"});
  const item=page.getByRole("button",{name:/Prepare the client proposal Confirm/});
  await item.click();
  const drawer=page.getByRole("dialog",{name:"Item details"});
  await expect(drawer.getByRole("heading",{name:"Prepare the client proposal"})).toBeVisible();
  await expect(drawer.getByText("Client context stays exactly as written.",{exact:false})).toBeVisible();
  await page.screenshot({path:"test-results/run-ux/desktop-drawer.png",animations:"disabled"});
  await page.keyboard.press("Escape");await expect(drawer).toHaveCount(0);await expect(item).toBeFocused();
  expect(await page.locator(".cr-queue-row").first().boundingBox().then(box=>box!.height)).toBeLessThan(105);
});
test("command search navigates and opens only current-world items using keyboard",async({page})=>{
  await page.goto("/tests/run-visual/ux-harness.html");await page.keyboard.press("Control+k");
  const input=page.getByRole("combobox",{name:"Search items or navigate"});await expect(input).toBeFocused();
  await input.fill("proposal");await page.screenshot({path:"test-results/run-ux/command-search.png",animations:"disabled"});await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog",{name:"Item details"})).toBeVisible();await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Search",exact:true}).click();await input.fill("Intake");await page.keyboard.press("Enter");
  await expect(page.getByRole("tab",{name:"Intake",exact:true})).toHaveAttribute("aria-selected","true");
});
test("tabs use arrow/home/end keys; language switch covers controls, dialogs and validation",async({page})=>{
  await page.goto("/tests/run-visual/ux-harness.html");
  await page.getByRole("tab",{name:"Queue",exact:true}).focus();await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab",{name:"Projects",exact:true})).toBeFocused();await page.keyboard.press("Home");
  await expect(page.getByRole("tab",{name:"Today",exact:true})).toBeFocused();
  await page.getByRole("button",{name:"Español",exact:true}).click();await page.getByRole("tab",{name:"Entrada",exact:true}).click();
  await expect(page.getByText("¿Es un compromiso?",{exact:false})).toBeVisible();
  await page.getByRole("button",{name:"Datos y validación",exact:true}).click();
  await page.getByLabel("Elegir archivo JSON").setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from("[]")});
  await expect(page.getByText("Se esperaba un objeto JSON.",{exact:true})).toBeVisible();
  await page.screenshot({path:"test-results/run-ux/validation-es.png",animations:"disabled"});
  await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Datos y validación",exact:true})).toBeFocused();
  await page.getByRole("button",{name:"English",exact:true}).click();await expect(page.getByRole("tab",{name:"Intake",exact:true})).toBeVisible();
});
test("secondary actions remain available; delegate/date/cancel/completion work with fixture-only callbacks",async({page})=>{
  await page.goto("/tests/run-visual/ux-harness.html?actions=1");
  await page.getByRole("button",{name:"Actions for Prepare the client proposal",exact:true}).click();
  await page.getByRole("menuitem",{name:"Delegate",exact:true}).click();
  const drawer=page.getByRole("dialog");await drawer.getByLabel("Who",{exact:true}).fill("Sam");await drawer.getByLabel("Date",{exact:true}).fill("2026-11-14");
  await drawer.getByRole("button",{name:"Save",exact:true}).click();await expect(drawer.getByText("Sam",{exact:true})).toBeVisible();
  await drawer.getByRole("button",{name:"Renegotiate",exact:true}).click();await drawer.getByLabel("Date",{exact:true}).fill("2026-11-16");await drawer.getByRole("button",{name:"Save",exact:true}).click();
  await expect(drawer.getByText("Nov 16",{exact:true})).toBeVisible();await drawer.getByRole("button",{name:"Mark complete",exact:true}).click();
  await expect(drawer).toHaveCount(0);await expect(page.getByRole("button",{name:/Prepare the client proposal Confirm/})).toHaveCount(0);
});
test("phone menu is not clipped, drawer scrolls, and no horizontal page overflow",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/tests/run-visual/ux-harness.html");
  await page.getByRole("button",{name:"Actions for Review delivery milestone 27",exact:true}).click();
  const menu=page.getByRole("menu");await expect(menu).toBeVisible();const box=await menu.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");await page.getByRole("button",{name:/Review delivery milestone 27 Confirm/}).click();
  await page.getByRole("dialog").getByText("Record reference",{exact:true}).scrollIntoViewIfNeeded();
  await expect(page.getByRole("dialog").getByText("Record reference",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/run-ux/mobile-drawer.png",animations:"disabled"});
});
test("search cannot cross worlds and dialogs trap focus without losing drafts",async({page})=>{
  await page.route("**/__run_ux_fixture",route=>route.fulfill({json:[...rows,{...rows[0],id:"foreign",runWorld:"Boldr AI",title:"Foreign world secret"}]}));
  await page.goto("/tests/run-visual/ux-harness.html");await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("Foreign world secret");await expect(page.getByText("No matching items or commands.",{exact:true})).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(0);await page.keyboard.press("Escape");
  await page.getByRole("button",{name:/Prepare the client proposal Confirm/}).click();
  for(let i=0;i<9;i++){await page.keyboard.press("Tab");expect(await page.evaluate(()=>!!document.activeElement?.closest("dialog"))).toBe(true);}
  await page.getByRole("dialog").getByRole("button",{name:"Delegate",exact:true}).click();
  await page.getByRole("dialog").getByLabel("Who",{exact:true}).fill("Draft owner");
  await page.getByRole("dialog").getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(page.getByRole("dialog").getByRole("heading",{name:"Prepare the client proposal",exact:true})).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Alex",{exact:true})).toBeVisible();
});
test("Spanish queue, command, drawer and manifesto keep user content intact",async({page})=>{
  await page.goto("/tests/run-visual/ux-harness.html");await page.getByRole("button",{name:"Español",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Hacer",exact:true})).toBeVisible();await page.keyboard.press("Control+k");
  await expect(page.getByRole("combobox",{name:"Busca ítems o navega"})).toBeFocused();await page.getByRole("combobox").fill("proposal");await page.keyboard.press("Enter");
  const drawer=page.getByRole("dialog",{name:"Detalles del ítem"});await expect(drawer.getByRole("heading",{name:"Siguiente paso",exact:true})).toBeVisible();
  await expect(drawer.getByText("Confirm the delivery scope",{exact:true})).toBeVisible();await expect(drawer.getByRole("button",{name:"Marcar como terminado",exact:true})).toBeVisible();
  await page.screenshot({path:"test-results/run-ux/desktop-drawer-es.png",animations:"disabled"});await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Manifiesto",exact:true}).click();await expect(page.getByText("Construyo dos cosas:",{exact:false})).toBeVisible();await page.keyboard.press("Escape");
});

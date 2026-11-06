import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryMcpRepo, issueToken, executeTool, authenticateMcp, handleMcpHttp } from "../worker/mcp/remoteCore.js";
import { createWorkerMcpRepo } from "../worker/mcp/remoteRepo.js";

const now=Date.parse("2026-11-06T12:00:00Z");
const user={uid:"owner",email:"alejandro@getboldr.ai",emailVerified:true};
const input={name:"Grok Run",workspaceIds:["work"],permission:"read-write",canDelete:false,admin:false,runDelegation:{workspaceWorlds:{work:"Pure AI"}}};
function seed(){const repo=createMemoryMcpRepo();repo.state.workspaces.push({id:"work",name:"Work",ownerId:user.uid},{id:"other",name:"Other",ownerId:user.uid});return repo;}
async function setup(){const repo=seed();const issued=await issueToken(repo,user,input,now);return {repo,token:repo.state.tokens[0],secret:issued.token};}
function draft(external_id="source:1"){return {workspace_id:"work",external_id,title:"Prepare client proposal",lane:"projects",decision:"make",epic:"Delivery",context:"Client requested proposal",deliverable:"Reviewed proposal",doneWhen:"Client receives reviewed proposal",nextStep:"Draft scope",source:"mail:1"};}

test("production repository exposes atomic Run storage and never silently falls back",async()=>{
  const repo=createWorkerMcpRepo({});
  assert.equal(typeof repo.mutateRun,"function");
  await assert.rejects(repo.mutateRun("work",async()=>({writes:[],value:{}})),/not configured/);
});
test("MCP discovery advertises only implemented Run tools and usable required fields",async()=>{
  const {repo,secret}=await setup();
  const response=await handleMcpHttp({repo,method:"POST",authorization:`Bearer ${secret}`,accept:"application/json",now,body:{jsonrpc:"2.0",id:1,method:"tools/list"}});
  const tools=JSON.parse(response.body).result.tools;
  assert.deepEqual(tools.map(tool=>tool.name).sort(),["list_workspaces","create_item","update_item","add_comment","get_readiness","list_queue","get_caps"].sort());
  const schema=tools.find(tool=>tool.name==="create_item").inputSchema;
  assert.equal(schema.required.includes("external_id"),true);assert.equal(schema.required.includes("type"),false);
});

test("only the verified owner can explicitly delegate Run; unsafe worlds/permissions refused",async()=>{
  const repo=seed();
  for(const candidate of [{...user,email:"other@example.com"},{...user,emailVerified:false}]) await assert.rejects(issueToken(repo,candidate,input,now),{code:"forbidden"});
  for(const runDelegation of [{workspaceWorlds:{work:"Personal"}},{workspaceWorlds:{other:"Pure AI"}}]) await assert.rejects(issueToken(repo,user,{...input,runDelegation},now),{code:"invalid_run_mapping"});
  await assert.rejects(issueToken(repo,user,{...input,canDelete:true},now),{code:"invalid_run_permissions"});
  await assert.rejects(issueToken(repo,user,{...input,admin:true},now),{code:"invalid_run_permissions"});
  assert.equal(repo.state.tokens.length,0);
});
test("Run token stores only a hash; ordinary tokens do not gain Run tools",async()=>{
  const {repo,token,secret}=await setup();
  assert.equal(token.canDelete,false);assert.equal(JSON.stringify(token).includes(secret),false);
  const normal=await issueToken(repo,user,{...input,runDelegation:undefined},now);
  await assert.rejects(executeTool(repo,repo.state.tokens.find(row=>row.id===normal.id),"get_caps",{workspace_id:"work"},now));
  token.revokedAt=new Date(now).toISOString();
  await assert.rejects(authenticateMcp(repo,`Bearer ${secret}`,now));
});
test("retries are idempotent; dry runs have no side effects; completed items require evidence",async()=>{
  const {repo,token}=await setup();const auditCount=repo.state.audits.length;
  await executeTool(repo,token,"create_item",{...draft(),dry_run:true},now);
  assert.equal(repo.state.items.length,0);assert.equal(repo.state.audits.length,auditCount);
  const created=await executeTool(repo,token,"create_item",draft(),now);
  await executeTool(repo,token,"create_item",draft(),now);
  assert.equal(repo.state.items.length,1);assert.equal(repo.state.audits.length,auditCount+1);
  await assert.rejects(executeTool(repo,token,"update_item",{workspace_id:"work",item_id:created.item_id,outcome:"done"},now),{code:"evidence_required"});
  await executeTool(repo,token,"update_item",{workspace_id:"work",item_id:created.item_id,outcome:"done",evidence_source_id:"sent-mail:2"},now);
  assert.equal(repo.state.items[0].status,"done");
  assert.equal((await executeTool(repo,token,"list_queue",{workspace_id:"work"},now)).total,0);
});
test("concurrent creates enforce the Make cap without orphan audit entries",async()=>{
  const {repo,token}=await setup();const before=repo.state.audits.length;
  const results=await Promise.allSettled(Array.from({length:6},(_,i)=>executeTool(repo,token,"create_item",draft(`mail:${i}`),now)));
  assert.equal(results.filter(row=>row.status==="fulfilled").length,5);
  assert.equal(repo.state.items.length,5);assert.equal(repo.state.audits.length,before+5);
  assert.equal(results.find(row=>row.status==="rejected")?.reason.code,"cap_exceeded");
});
test("world, account, workspace and tool boundaries fail closed",async()=>{
  const {repo,token}=await setup();
  await assert.rejects(executeTool(repo,token,"create_item",{...draft(),world:"Boldr AI"},now),{code:"world_mismatch"});
  await assert.rejects(executeTool(repo,token,"create_item",{...draft(),workspace_id:"other"},now));
  await assert.rejects(executeTool(repo,token,"delete_item",{workspace_id:"work",item_id:"x"},now),{code:"run_tool_unavailable"});
  await assert.rejects(executeTool(repo,token,"update_item",{workspace_id:"work",item_id:"foreign"},now),{code:"forbidden"});
  repo.state.items.push({...draft(),id:"hidden",workspaceId:"work",userId:"other",runWorld:"Pure AI",runDecision:"make"});
  assert.equal((await executeTool(repo,token,"list_queue",{workspace_id:"work"},now)).total,0);
  const readiness=await executeTool(repo,token,"get_readiness",{workspace_id:"work"},now);
  assert.equal(readiness.ready,false);assert.equal(readiness.scheduling,false);
});

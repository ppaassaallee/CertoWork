import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryMcpRepo,issueToken,executeTool } from "../worker/mcp/remoteCore.js";
import { handleRunOwner,ownerMappings } from "../worker/mcp/runWorkflow.js";

const now=Date.parse("2026-11-06T12:00:00Z");
const user={uid:"owner",email:"alejandro@getboldr.ai",emailVerified:true};
async function setup(){
  const repo=createMemoryMcpRepo();
  repo.state.workspaces.push({id:"pure",ownerId:"owner"},{id:"boldr",ownerId:"owner"});
  await issueToken(repo,user,{name:"Lucy",workspaceIds:["pure","boldr"],permission:"read-write",canDelete:false,runDelegation:{workspaceWorlds:{pure:"Pure AI",boldr:"Boldr AI"}}},now);
  const token=repo.state.tokens[0];
  const draft={workspace_id:"pure",external_id:"LUCY-GMAIL-1",title:"Prepare client proposal",lane:"projects",decision:"make",epic:"Client · Delivery",context:"Requested by client",deliverable:"Reviewed proposal",doneWhen:"Client has approved proposal",nextStep:"Draft scope",source:"Gmail · 2026-11-06"};
  const created=await executeTool(repo,token,"create_item",draft,now);
  return {repo,token,itemId:created.item_id,draft};
}
test("core readiness probes storage, reports propose and keeps external schedules/sources separate",async()=>{
  const {repo,token}=await setup();
  const result=await executeTool(repo,token,"get_readiness",{workspace_id:"pure"},now);
  assert.equal(result.ready,true);assert.deepEqual(result.scopes,["read","write","propose"]);
  assert.equal(result.scheduling.executor,"external_grok");assert.equal(result.sources.verified_by_certo,false);
  const incomplete={...repo,getRunControl:undefined};
  assert.equal((await executeTool(incomplete,token,"get_readiness",{workspace_id:"pure"},now)).ready,false);
});
test("propose dry run and retry are safe; only verified owner can atomically approve/reject",async()=>{
  const {repo,token,itemId}=await setup();
  const args={workspace_id:"pure",external_id:"proposal:1",item_id:itemId,action:"retitle",value:"Deliver reviewed proposal to client",reason:"Source confirms the real deliverable",evidence_source_id:"mail:2"};
  const before=repo.state.audits.length;
  await executeTool(repo,token,"propose_decision",{...args,dry_run:true},now);
  assert.equal(repo.state.audits.length,before);assert.equal(Object.keys(repo.state.runControls).length,0);
  const proposal=await executeTool(repo,token,"propose_decision",args,now);
  const retry=await executeTool(repo,token,"propose_decision",args,now);
  assert.equal(retry.proposal_id,proposal.proposal_id);assert.equal(repo.state.items[0].title,"Prepare client proposal");
  await assert.rejects(executeTool(repo,token,"approve_proposal",{workspace_id:"pure",proposal_id:proposal.proposal_id},now),{code:"run_tool_unavailable"});
  const review={world:"Pure AI",workspace_id:"pure",proposal_id:proposal.proposal_id,decision:"approve"};
  await assert.rejects(handleRunOwner(repo,{...user,email:"other@example.com"},"/api/run/agent/review",review,now),{code:"forbidden"});
  await assert.rejects(handleRunOwner(repo,{...user,emailVerified:false},"/api/run/agent/review",review,now),{code:"forbidden"});
  await handleRunOwner(repo,user,"/api/run/agent/review",review,now);
  assert.equal(repo.state.items[0].title,args.value);
  const audits=repo.state.audits.length;
  assert.equal((await handleRunOwner(repo,user,"/api/run/agent/review",review,now)).already_reviewed,true);
  assert.equal(repo.state.audits.length,audits);
});
test("stale proposals cannot overwrite newer changes; rejected proposals never mutate items",async()=>{
  const {repo,token,itemId}=await setup();
  const args={workspace_id:"pure",external_id:"drop:1",item_id:itemId,action:"drop",reason:"Client cancelled scope",evidence_source_id:"mail:3"};
  const proposal=await executeTool(repo,token,"propose_decision",args,now);
  await executeTool(repo,token,"update_item",{workspace_id:"pure",item_id:itemId,nextStep:"Reconfirm cancellation"},now+1);
  const review={world:"Pure AI",proposal_id:proposal.proposal_id,decision:"approve"};
  await assert.rejects(handleRunOwner(repo,user,"/api/run/agent/review",review,now),{code:"stale_proposal"});
  assert.equal(repo.state.items[0].status,"open");
  await handleRunOwner(repo,user,"/api/run/agent/review",{...review,decision:"reject"},now);
  assert.equal(repo.state.items[0].status,"open");
});
test("approval rechecks Make cap rather than bypassing it through proposals",async()=>{
  const {repo,token,draft,itemId}=await setup();
  await executeTool(repo,token,"update_item",{workspace_id:"pure",item_id:itemId,decision:"decide"},now);
  const proposed=await executeTool(repo,token,"propose_decision",{workspace_id:"pure",external_id:"make:1",item_id:itemId,action:"move_to_make",reason:"Important commitment",evidence_source_id:"mail:4"},now);
  for(let i=0;i<5;i++)await executeTool(repo,token,"create_item",{...draft,external_id:`new:${i}`},now);
  await assert.rejects(handleRunOwner(repo,user,"/api/run/agent/review",{world:"Pure AI",proposal_id:proposed.proposal_id,decision:"approve"},now),{code:"cap_exceeded"});
  assert.equal(repo.state.items.find(row=>row.id===itemId)?.runDecision,"decide");
});
test("briefs persist into the UI snapshot, replace same edition and stay in their world",async()=>{
  const {repo,token}=await setup();
  const args={workspace_id:"pure",date:"2026-11-06",kind:"morning",body:"Decide whether to approve the client scope.",source_ids:["mail:1"]};
  await executeTool(repo,token,"record_brief",{...args,dry_run:true},now);
  assert.equal((await executeTool(repo,token,"get_brief",{workspace_id:"pure"},now)).brief,null);
  await executeTool(repo,token,"record_brief",args,now);
  await executeTool(repo,token,"record_brief",{...args,body:"Updated morning brief."},now+1);
  const snapshot=await handleRunOwner(repo,user,"/api/run/agent/snapshot",{world:"Pure AI"},now);
  assert.equal(snapshot.workspace_id,"pure");assert.equal(snapshot.control.briefs.length,1);
  assert.equal(snapshot.control.briefs[0].body,"Updated morning brief.");
  assert.equal((await executeTool(repo,token,"get_brief",{workspace_id:"boldr"},now)).brief,null);
  await assert.rejects(executeTool(repo,token,"record_brief",{...args,source_ids:[]},now),{code:"evidence_required"});
  await assert.rejects(executeTool(repo,token,"record_brief",{...args,date:"2026-02-30"},now),{code:"invalid_date"});
});
test("search includes closed items for dedup and never leaks across worlds or owners",async()=>{
  const {repo,token,itemId}=await setup();
  await executeTool(repo,token,"update_item",{workspace_id:"pure",item_id:itemId,outcome:"done",evidence_source_id:"sent:1"},now);
  const result=await executeTool(repo,token,"search",{workspace_id:"pure",external_id:"LUCY-GMAIL-1"},now);
  assert.equal(result.total,1);assert.equal(result.items[0].status,"done");
  assert.equal((await executeTool(repo,token,"search",{workspace_id:"boldr"},now)).total,0);
  assert.equal((await executeTool(repo,token,"search",{workspace_id:"pure",include_closed:false},now)).total,0);
  repo.state.items.push({id:"legacy",workspaceId:"pure",userId:user.uid,title:"Legacy client proposal",externalId:"old:1",status:"open"});
  const legacy=await executeTool(repo,token,"search",{workspace_id:"pure",query:"legacy proposal"},now);
  assert.equal(legacy.items[0].legacy,true);assert.equal(legacy.items[0].enrichment_supported,false);
  await assert.rejects(executeTool(repo,token,"create_item",{workspace_id:"pure",external_id:"old:1"},now),{code:"legacy_conflict"});
});
test("sync cursors survive retries and reject stale writers without claiming schedules run",async()=>{
  const {repo,token}=await setup();
  const args={workspace_id:"pure",expected_revision:0,state:{world:"Pure AI",last_run_at:"2026-11-06T12:00:00Z",last_run_kind:"morning",processed:["mail:1"],aliases:{},open_questions:[]},log:{summary:"One event reviewed",failed_sources:["Outlook"]}};
  await executeTool(repo,token,"record_sync_state",{...args,dry_run:true},now);
  assert.equal((await executeTool(repo,token,"get_sync_state",{workspace_id:"pure"},now)).revision,0);
  await executeTool(repo,token,"record_sync_state",args,now);
  await assert.rejects(executeTool(repo,token,"record_sync_state",args,now),{code:"stale_sync"});
  const saved=await executeTool(repo,token,"get_sync_state",{workspace_id:"pure"},now);
  assert.equal(saved.revision,1);assert.deepEqual(saved.logs[0].failed_sources,["Outlook"]);
});
test("world selector resolves live mappings; revoked or contradictory mappings fail closed",async()=>{
  const {repo,token}=await setup();
  assert.equal((await ownerMappings(repo,user,now)).length,2);
  assert.equal((await handleRunOwner(repo,user,"/api/run/agent/snapshot",{world:"Boldr AI"},now)).workspace_id,"boldr");
  await assert.rejects(handleRunOwner(repo,user,"/api/run/agent/snapshot",{world:"Pure AI",workspace_id:"boldr"},now),{code:"unmapped_world"});
  token.revokedAt=new Date(now).toISOString();
  await assert.rejects(handleRunOwner(repo,user,"/api/run/agent/snapshot",{world:"Pure AI"},now),{code:"unmapped_world"});
});
test("an oversized control write is rejected without changing state or audit",async()=>{
  const {repo,token}=await setup();
  const before=repo.state.audits.length;
  await assert.rejects(executeTool(repo,token,"record_sync_state",{workspace_id:"pure",expected_revision:0,state:{world:"Pure AI",last_run_at:"2026-11-06T12:00:00Z",last_run_kind:"morning",processed:Array.from({length:2000},(_,i)=>`${i}:${"x".repeat(290)}`)},log:{summary:"Too large"}},now),{code:"state_too_large"});
  assert.equal(Object.keys(repo.state.runControls).length,0);assert.equal(repo.state.audits.length,before);
});
test("core sync can read, write, propose, record brief/state and render matching owner snapshot",async()=>{
  const {repo,token,itemId}=await setup();
  await executeTool(repo,token,"add_comment",{workspace_id:"pure",item_id:itemId,comment:"Progress: scope received · mail:2",dry_run:true},now);
  await executeTool(repo,token,"add_comment",{workspace_id:"pure",item_id:itemId,comment:"Progress: scope received · mail:2"},now);
  const proposal=await executeTool(repo,token,"propose_decision",{workspace_id:"pure",item_id:itemId,external_id:"review:mail2",action:"mark_done",reason:"Client confirmed receipt",evidence_source_id:"mail:2"},now);
  await executeTool(repo,token,"record_brief",{workspace_id:"pure",date:"2026-11-06",kind:"morning",body:"Review the proposed completion of the client proposal.",source_ids:["mail:2"]},now);
  await executeTool(repo,token,"record_sync_state",{workspace_id:"pure",expected_revision:0,state:{world:"Pure AI",last_run_at:new Date(now).toISOString(),last_run_kind:"morning",processed:["mail:2"]},log:{summary:"One item reviewed; one proposal awaiting approval.",failed_sources:["Outlook"]}},now);
  const snapshot=await handleRunOwner(repo,user,"/api/run/agent/snapshot",{world:"Pure AI"},now);
  assert.equal(snapshot.control.proposals.filter(row=>row.status==="pending").length,1);
  assert.equal(snapshot.control.briefs.length,1);assert.equal(snapshot.control.sync.revision,1);
  assert.equal(snapshot.items[0].status,"open");
  await handleRunOwner(repo,user,"/api/run/agent/review",{world:"Pure AI",proposal_id:proposal.proposal_id,decision:"approve"},now);
  assert.equal((await executeTool(repo,token,"list_queue",{workspace_id:"pure"},now)).total,0);
  assert.equal((await executeTool(repo,token,"search",{workspace_id:"pure",external_id:"LUCY-GMAIL-1"},now)).items[0].status,"done");
  assert.equal((await executeTool(repo,token,"get_readiness",{workspace_id:"boldr"},now)).ready,true);
});
test("thousands of legacy records are not reread for cap writes; source IDs cannot cross worlds",async()=>{
  const {repo,token,draft}=await setup();
  for(let i=0;i<3000;i++)repo.state.items.push({id:`legacy:${i}`,workspaceId:"pure",userId:user.uid,title:"Legacy",status:"open"});
  const result=await executeTool(repo,token,"create_item",{...draft,external_id:"fresh:2"},now);
  assert.equal(result.created,true);
  assert.equal((await executeTool(repo,token,"get_readiness",{workspace_id:"pure"},now)).ready,true);
  repo.state.items.push({id:"other-world-source",workspaceId:"pure",userId:user.uid,runWorld:"Boldr AI",externalId:"world-conflict",status:"open"});
  await assert.rejects(executeTool(repo,token,"create_item",{...draft,external_id:"world-conflict"},now),{code:"external_id_conflict"});
});

import { isRunOwner, hasRunDelegation, validateRunDraft } from "./runDelegation.js";
import { checkTitle } from "../../src/lib/certoRun/intake.ts";
import { checkMoveToMake, checkSetPriority } from "../../src/lib/certoRun/caps.ts";
import { runDocToDeskItem } from "../../src/lib/certoRun/store.ts";

const fail = (code,message,status=400) => { throw Object.assign(new Error(message),{code,status}); };
const schema = (properties,required=["workspace_id"]) => ({type:"object",properties:{workspace_id:{type:"string"},world:{type:"string"},...properties},required,additionalProperties:false});
export const RUN_WORKFLOW_TOOLS = [
  {name:"list_proposals",description:"Read owner-scoped pending proposals. Only the human owner can review them in Run → Queue → Decide.",inputSchema:schema({})},
  {name:"search",description:"Search your Run items and your owned legacy items in the delegated workspace, including closed items for dedup. Legacy matches are flagged; do not recreate them. Legacy enrichment is not supported.",inputSchema:schema({query:{type:"string"},external_id:{type:"string"},include_closed:{type:"boolean"},page_size:{type:"integer",minimum:1,maximum:200},cursor:{type:"integer",minimum:0}})},
  {name:"list_fields",description:"Read the Run vocabulary and existing owner-scoped labels. Does not create catalogs.",inputSchema:schema({})},
  {name:"propose_decision",description:"Propose a supported item change for the human owner to approve in Run → Decide. Agents cannot approve. Use dry_run first; external_id makes retries idempotent.",inputSchema:schema({external_id:{type:"string"},item_id:{type:"string"},action:{type:"string",enum:["retitle","set_priority","drop","mark_done","renegotiate","move_to_make","delegate"]},value:{type:"string"},reason:{type:"string"},evidence_source_id:{type:"string"},dry_run:{type:"boolean"}},["workspace_id","external_id","item_id","action","reason","evidence_source_id"])},
  {name:"record_brief",description:"Persist a source-backed daily brief visible in Run → Today. Retrying the same date/kind replaces that edition, not another world.",inputSchema:schema({date:{type:"string"},kind:{type:"string",enum:["morning","midday"]},body:{type:"string"},source_ids:{type:"array",items:{type:"string"}},dry_run:{type:"boolean"}},["workspace_id","date","kind","body","source_ids"])},
  {name:"get_brief",description:"Read the latest brief or an exact date/kind.",inputSchema:schema({date:{type:"string"},kind:{type:"string",enum:["morning","midday"]}})},
  {name:"get_sync_state",description:"Read the bounded per-world assistant cursor/log. Source credentials and scheduling remain in Grok.",inputSchema:schema({})},
  {name:"record_sync_state",description:"Persist a bounded per-world cursor/log with optimistic concurrency. Record failed sources honestly; this does not activate a schedule.",inputSchema:schema({expected_revision:{type:"integer",minimum:0},state:{type:"object"},log:{type:"object"},dry_run:{type:"boolean"}},["workspace_id","expected_revision","state","log"])},
];
export const RUN_WORKFLOW_NAMES=RUN_WORKFLOW_TOOLS.map(tool=>tool.name);
export async function runControlId(userId,workspaceId,world) {
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([userId,workspaceId,world])));
  return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,"0")).join("");
}
export async function runScope(repo,token,args) {
  const workspaceId=String(args.workspace_id||"");
  const world=token.runDelegation?.workspaceWorlds?.[workspaceId];
  if(!hasRunDelegation(token)||!world||!token.workspaceIds.includes(workspaceId)||!await repo.userCanAccess(token.userId,workspaceId))fail("forbidden","Workspace is not delegated.",403);
  if(args.world!==undefined&&args.world!==world)fail("world_mismatch","World does not match workspace.",403);
  return {workspaceId,world,userId:token.userId,controlId:await runControlId(token.userId,workspaceId,world)};
}
function emptyControl(scope) {return {userId:scope.userId,workspaceId:scope.workspaceId,world:scope.world,proposals:[],briefs:[],sync:{revision:0,state:{},logs:[]}};}
function checkedControl(scope,record) {
  if(!record)return emptyControl(scope);
  if(record.userId!==scope.userId||record.workspaceId!==scope.workspaceId||record.world!==scope.world)fail("scope_mismatch","Control record has inconsistent ownership.",403);
  return structuredClone(record);
}
function ownRows(records,scope) {
  if(records.length>=2000)fail("incomplete_snapshot","Cannot use a partial workspace snapshot.",409);
  return records.filter(row=>row.workspaceId===scope.workspaceId&&row.userId===scope.userId&&row.runWorld===scope.world);
}
function requireText(value,name,max=2000) {
  if(typeof value!=="string"||!value.trim()||value.length>max)fail("invalid_field",`${name} requires 1–${max} characters.`);
  return value.trim();
}
function validDate(value) {
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(`${value}T00:00:00Z`))||new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)!==value)fail("invalid_date","Expected a valid YYYY-MM-DD date.");
  return value;
}
function itemFingerprint(row) {
  return JSON.stringify([row.title,row.priority,row.status,row.runDecision,row.runOutcome||null,row.dueDate||"",row.assigneeName||"",row.runContext,row.runDeliverable,row.runDoneWhen,row.runNextStep]);
}
function proposalPatch(proposal,target,items,scope,now) {
  const value=proposal.value,at=new Date(now).toISOString();
  let patch={};
  if(proposal.action==="retitle") {
    if(!checkTitle(value).ok)fail("invalid_title","The proposed title must satisfy Run title rules.");
    patch={title:value};
  } else if(proposal.action==="set_priority") {
    if(!["P1","P2","P3","P4"].includes(value))fail("invalid_priority","Use P1–P4.");
    const check=checkSetPriority(items,{workspace:scope.world},target.id,value);
    if(!check.ok)fail("cap_exceeded","Priority cap reached.",409);
    patch={priority:value};
  } else if(proposal.action==="move_to_make") {
    if(target.runLane==="admin")fail("invalid_lane","Admin cannot enter Make.");
    const check=checkMoveToMake(items,{workspace:scope.world},target.id);
    if(!check.ok)fail("cap_exceeded","Make cap reached.",409);
    patch={runDecision:"make"};
  } else if(proposal.action==="mark_done") patch={status:"done",runOutcome:{kind:"done",at,sourceId:proposal.evidenceSourceId}};
  else if(proposal.action==="drop") patch={status:"done",runOutcome:{kind:"dropped",at,note:proposal.reason,sourceId:proposal.evidenceSourceId}};
  else if(proposal.action==="renegotiate") patch={dueDate:validDate(value),runOutcome:{kind:"renegotiated",date:value,at,sourceId:proposal.evidenceSourceId}};
  else if(proposal.action==="delegate") patch={runDecision:"delegate",assigneeName:requireText(value,"delegate",200),runOutcome:{kind:"delegated",owner:value,at,sourceId:proposal.evidenceSourceId}};
  else fail("unsupported_action","Unsupported proposal action.");
  return {...target,...patch,updatedAt:at};
}
function persist(scope,control,value,token,action,now,extra=[]) {
  control.updatedAt=new Date(now).toISOString();
  if(new TextEncoder().encode(JSON.stringify(control)).length>240000)fail("state_too_large","Run state exceeds its safe size limit.",409);
  return {value,writes:[...extra,{collection:"run_agent_state",id:scope.controlId,data:control},{collection:"mcp_audit_events",id:`run_${crypto.randomUUID()}`,data:{userId:scope.userId,workspaceId:scope.workspaceId,world:scope.world,action,tokenId:token?.id||null,at:control.updatedAt}}]};
}
export async function runReadiness(repo,token,args,now=Date.now()) {
  const scope=await runScope(repo,token,args);
  const writable=token.permission==="read-write"&&typeof repo.mutateRun==="function";
  const checks={read:typeof repo.listRunItems==="function",write:writable,propose:writable&&typeof repo.getRunControl==="function",brief:writable&&typeof repo.getRunControl==="function",owner_review:true};
  const mappings=await delegatedMappings(repo,token.userId,now);
  checks.owner_review=mappings.some(mapping=>mapping.world===scope.world&&mapping.workspace_id===scope.workspaceId);
  if(checks.propose)checkedControl(scope,await repo.getRunControl(scope.controlId));
  if(checks.read)ownRows(await repo.listRunItems(scope.workspaceId,scope.userId,scope.world),scope);
  const ready=Object.values(checks).every(Boolean);
  return {workspace_id:scope.workspaceId,world:scope.world,ready,contract:"certo-run-sync/1",profile:"core_sync",full_operating_brief_ready:false,checks,scopes:["read","write","propose"],direct_item_writes:checks.write,proposals:checks.propose,brief:checks.brief,scheduling:{executor:"external_grok",required_for_mcp_ready:false,configured_by_certo:false},sources:{executor:"external_grok",verified_by_certo:false},missing:Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key),unsupported:["legacy item enrichment","set_parent","bulk_update","get_close","get_projects","set_pipeline_stage","set_health","get_allocation","set_allocation","get_week_plan","record_checkin","get_life"],delete:false,admin:false};
}
export async function executeRunWorkflow(repo,token,name,args,now=Date.now()) {
  const scope=await runScope(repo,token,args);
  const envelope={workspace_id:scope.workspaceId,world:scope.world};
  if(name==="search"||name==="list_fields") {
    const records=name==="search"?await repo.listOwnedRunCandidates(scope.workspaceId,scope.userId):await repo.listRunItems(scope.workspaceId,scope.userId,scope.world);
    const rows=ownRows(records,scope);
    if(name==="list_fields")return {...envelope,lanes:["commercial","projects","admin"],decisions:["make","decide","delegate","follow_up","admin_batch"],priorities:["P1","P2","P3","P4"],epics:[...new Set(rows.map(row=>row.epic).filter(Boolean))],features:[...new Set(rows.map(row=>row.feature).filter(Boolean))],tags:[...new Set(rows.flatMap(row=>Array.isArray(row.tags)?row.tags:[]))],catalog_source:"existing owner Run items only",catalog_admin:false};
    const query=String(args.query||"").toLowerCase().trim();
    // Expose owned legacy matches for dedup, but never silently migrate/recreate them.
    const candidates=[...rows,...records.filter(row=>row.workspaceId===scope.workspaceId&&row.userId===scope.userId&&!row.runWorld)];
    const terms=query.split(/\s+/).filter(Boolean);
    const found=candidates.filter(row=>(args.include_closed!==false||!["done","completed","archived","deleted"].includes(row.status))&&(!args.external_id||row.externalId===args.external_id)&&terms.every(term=>[row.title,row.epic,row.runDeliverable,row.runContext,row.description].join(" ").toLowerCase().includes(term))).sort((a,b)=>a.id.localeCompare(b.id));
    const cursor=Math.max(0,Math.floor(Number(args.cursor)||0)),size=Math.max(1,Math.min(200,Math.floor(Number(args.page_size)||50)));
    return {...envelope,total:found.length,next_cursor:cursor+size<found.length?cursor+size:null,items:found.slice(cursor,cursor+size).map(row=>({id:row.id,item_id:row.id,external_id:row.externalId,title:row.title,epic:row.epic,deliverable:row.runDeliverable,status:row.status,updated_at:row.updatedAt,legacy:!row.runWorld,enrichment_supported:!!row.runWorld}))};
  }
  if(name==="get_brief"||name==="get_sync_state"||name==="list_proposals") {
    const control=checkedControl(scope,await repo.getRunControl(scope.controlId));
    if(name==="get_sync_state")return {...envelope,...control.sync};
    if(name==="list_proposals")return {...envelope,proposals:control.proposals.filter(row=>row.status==="pending").map(({fingerprint,...row})=>row)};
    return {...envelope,brief:[...control.briefs].reverse().find(brief=>(!args.date||brief.date===args.date)&&(!args.kind||brief.kind===args.kind))||null};
  }
  if(token.permission!=="read-write")fail("forbidden","Write delegation required.",403);
  return repo.mutateRun(scope.workspaceId,async(records,stored)=>{
    const control=checkedControl(scope,stored);
    let value;
    if(name==="propose_decision") {
      const rows=ownRows(records,scope),target=rows.find(row=>row.id===args.item_id);
      if(!target)fail("forbidden","Target item is not in this delegated world.",403);
      const externalId=requireText(args.external_id,"external_id",300);
      const duplicate=control.proposals.find(row=>row.externalId===externalId);
      if(duplicate)return {value:{...envelope,proposal_id:duplicate.id,status:duplicate.status,created:false},writes:[]};
      const proposal={id:crypto.randomUUID(),externalId,itemId:target.id,itemTitle:target.title,action:String(args.action),value:String(args.value||""),reason:requireText(args.reason,"reason"),evidenceSourceId:requireText(args.evidence_source_id,"evidence_source_id",500),status:"pending",createdAt:new Date(now).toISOString(),tokenId:token.id,fingerprint:itemFingerprint(target)};
      // Validate the action now, but caps are checked again at human approval.
      proposalPatch(proposal,target,[],scope,now);
      if(control.proposals.filter(row=>row.status==="pending").length>=100)fail("proposal_cap","Review existing proposals first.",409);
      control.proposals=[...control.proposals.filter(row=>row.status==="pending"),...control.proposals.filter(row=>row.status!=="pending").slice(-50),proposal];
      value={...envelope,proposal_id:proposal.id,status:"pending",created:true};
    } else if(name==="record_brief") {
      const date=validDate(args.date),kind=args.kind;
      if(!["morning","midday"].includes(kind))fail("invalid_kind","Use morning or midday.");
      if(!Array.isArray(args.source_ids)||!args.source_ids.length||args.source_ids.length>100||args.source_ids.some(id=>typeof id!=="string"||!id.trim()||id.length>500))fail("evidence_required","Provide 1–100 source IDs.");
      const brief={date,kind,body:requireText(args.body,"body",12000),sourceIds:args.source_ids,recordedAt:new Date(now).toISOString(),tokenId:token.id};
      control.briefs=[...control.briefs.filter(row=>row.date!==date||row.kind!==kind),brief].slice(-28);
      value={...envelope,date,kind,saved:true};
    } else if(name==="record_sync_state") {
      if(args.expected_revision!==control.sync.revision)fail("stale_sync","Reload get_sync_state before overwriting a newer sync.",409);
      if(!args.state||typeof args.state!=="object"||Array.isArray(args.state)||!args.log||typeof args.log!=="object"||Array.isArray(args.log))fail("invalid_state","state and log must be objects.");
      if(args.state.world!==scope.world)fail("world_mismatch","Sync state world must match delegation.",403);
      const processed=args.state.processed;
      if(!Array.isArray(processed)||processed.length>2000||processed.some(id=>typeof id!=="string"||id.length>300))fail("invalid_state","Keep at most 2,000 processed source IDs.");
      if(args.state.aliases&&(typeof args.state.aliases!=="object"||Array.isArray(args.state.aliases)||Object.keys(args.state.aliases).length>500||Object.values(args.state.aliases).some(value=>typeof value!=="string"||value.length>300)))fail("invalid_state","aliases must be a bounded name map.");
      if(args.state.open_questions&&(!Array.isArray(args.state.open_questions)||args.state.open_questions.length>100||args.state.open_questions.some(value=>typeof value!=="string"||value.length>500)))fail("invalid_state","Keep at most 100 concise open questions.");
      // Bound persisted state and allowlist its fields; source credentials stay in Grok.
      const state={world:scope.world,last_run_at:requireText(args.state.last_run_at,"last_run_at",40),last_run_kind:requireText(args.state.last_run_kind,"last_run_kind",20),processed,aliases:args.state.aliases||{},open_questions:args.state.open_questions||[]};
      if(!Number.isFinite(Date.parse(state.last_run_at))||!["morning","midday"].includes(state.last_run_kind))fail("invalid_state","Invalid sync timestamp/kind.");
      const log={at:new Date(now).toISOString(),summary:requireText(args.log.summary,"log.summary",4000),failed_sources:Array.isArray(args.log.failed_sources)?args.log.failed_sources.slice(0,30).map(String):[]};
      control.sync={revision:control.sync.revision+1,state,logs:[...control.sync.logs,log].slice(-14)};
      value={...envelope,revision:control.sync.revision,saved:true};
    } else fail("unknown_tool","Unsupported Run workflow tool.",404);
    if(args.dry_run===true)return {value:{...value,dry_run:true},writes:[]};
    return persist(scope,control,value,token,name,now);
  },{controlId:scope.controlId,readItems:name==="propose_decision",ownerId:scope.userId,world:scope.world});
}

export async function ownerMappings(repo,user,now=Date.now()) {
  if(!isRunOwner(user))fail("forbidden","Private Run owner required.",403);
  return delegatedMappings(repo,user.uid,now);
}
async function delegatedMappings(repo,userId,now) {
  const tokens=await repo.listTokens(userId),byWorld=new Map();
  for(const token of tokens) {
    if(!hasRunDelegation(token)||token.revokedAt||!Number.isFinite(Date.parse(token.expiresAt))||Date.parse(token.expiresAt)<=now)continue;
    for(const [workspaceId,world] of Object.entries(token.runDelegation.workspaceWorlds)) {
      if(!["Pure AI","Boldr AI"].includes(world))continue;
      if(!token.workspaceIds.includes(workspaceId)||!await repo.userCanAccess(userId,workspaceId))continue;
      if(byWorld.has(world)&&byWorld.get(world)!==workspaceId)fail("ambiguous_mapping","Two active delegations map the same world to different workspaces. Revoke the obsolete token.",409);
      byWorld.set(world,workspaceId);
    }
  }
  return [...byWorld].map(([world,workspace_id])=>({world,workspace_id}));
}
export async function handleRunOwner(repo,user,path,args,now=Date.now()) {
  const mappings=await ownerMappings(repo,user,now);
  if(path==="/api/run/agent/workspaces")return {mappings};
  const mapping=mappings.find(row=>row.world===args.world);
  if(!mapping||args.workspace_id&&mapping.workspace_id!==args.workspace_id)fail("unmapped_world","No active delegation maps this world to the requested workspace.",403);
  const scope={workspaceId:mapping.workspace_id,world:mapping.world,userId:user.uid,controlId:await runControlId(user.uid,mapping.workspace_id,mapping.world)};
  if(path==="/api/run/agent/snapshot")return {workspace_id:scope.workspaceId,world:scope.world,items:ownRows(await repo.listRunItems(scope.workspaceId,scope.userId,scope.world),scope),control:checkedControl(scope,await repo.getRunControl(scope.controlId))};
  if(path!=="/api/run/agent/review")fail("not_found","Unknown Run operation.",404);
  if(!["approve","reject","defer"].includes(args.decision))fail("invalid_decision","Choose approve, reject or defer.");
  return repo.mutateRun(scope.workspaceId,async(records,stored)=>{
    const control=checkedControl(scope,stored),proposal=control.proposals.find(row=>row.id===args.proposal_id);
    if(!proposal)fail("not_found","Proposal not found.",404);
    if(proposal.status!=="pending")return {value:{status:proposal.status,already_reviewed:true},writes:[]};
    if(args.decision==="defer")return {value:{status:"pending",deferred:true},writes:[]};
    const extra=[];
    if(args.decision==="approve") {
      const rows=ownRows(records,scope),target=rows.find(row=>row.id===proposal.itemId);
      if(!target)fail("forbidden","Target no longer belongs to this world.",403);
      if(itemFingerprint(target)!==proposal.fingerprint)fail("stale_proposal","Item changed since the proposal. Reject it and ask for a fresh proposal.",409);
      const items=rows.map(row=>runDocToDeskItem(row.id,row,{id:scope.workspaceId})).filter(Boolean);
      const next=proposalPatch(proposal,target,items,scope,now);
      validateRunDraft({title:next.title,lane:next.runLane,decision:next.runDecision,epic:next.epic,context:next.runContext,deliverable:next.runDeliverable,doneWhen:next.runDoneWhen,nextStep:next.runNextStep,source:next.runSource});
      const {id,...data}=next;extra.push({collection:"tasks",id,data});
    }
    proposal.status=args.decision==="approve"?"approved":"rejected";
    proposal.reviewedAt=new Date(now).toISOString();proposal.reviewedBy=user.uid;
    return persist(scope,control,{status:proposal.status},null,`proposal.${proposal.status}`,now,extra);
  },{controlId:scope.controlId,readItems:args.decision==="approve",ownerId:scope.userId,world:scope.world});
}

import { checkTitle } from "../../src/lib/certoRun/intake.ts";
import { runDocToDeskItem } from "../../src/lib/certoRun/store.ts";
import { DEFAULT_CAPS, queueCounts, p1Alive, adminOpen } from "../../src/lib/certoRun/queues.ts";
import { checkMoveToMake, checkAdminWrite, checkSetPriority } from "../../src/lib/certoRun/caps.ts";

export function isRunOwner(user) {
  return user?.emailVerified === true && String(user.email || "").trim().toLowerCase() === "alejandro@getboldr.ai";
}
export function hasRunDelegation(token) {
  return token?.runDelegation?.version === 1 && token.runDelegation.ownerUid === token.userId;
}
export function validateRunDelegation(user, input, workspaceIds) {
  if (!input) return null;
  if (!isRunOwner(user)) throw Object.assign(new Error("Only the designated verified owner may delegate Run."), {status:403, code:"forbidden"});
  const worlds = input.workspaceWorlds;
  if (!worlds || typeof worlds !== "object" || Array.isArray(worlds) || Object.keys(worlds).length !== workspaceIds.length) throw Object.assign(new Error("Map each selected workspace to one work world."), {status:400, code:"invalid_run_mapping"});
  const values = workspaceIds.map((id) => worlds[id]);
  if (values.some((world) => !["Pure AI", "Boldr AI"].includes(world)) || new Set(values).size !== values.length) throw Object.assign(new Error("Choose distinct Pure AI / Boldr AI workspaces. Personal is not delegated."), {status:400, code:"invalid_run_mapping"});
  return {version:1, ownerUid:user.uid, workspaceWorlds:Object.fromEntries(workspaceIds.map((id)=>[id,worlds[id]]))};
}
export const RUN_TOOL_NAMES = ["get_readiness", "list_queue", "get_caps"];
export const RUN_TOOLS = RUN_TOOL_NAMES.map((name) => ({name, description:`Owner-delegated Certo Run: ${name}. Always pass workspace_id. No Personal access.`, inputSchema:{type:"object",properties:{workspace_id:{type:"string"},queue:{type:"string",enum:["make","decide","follow_up","admin_batch","delegated"]},page_size:{type:"integer",maximum:200},cursor:{type:"integer",minimum:0},since:{type:"string"},fields:{type:"array",items:{type:"string"}}},required:["workspace_id"]}}));

export async function executeRunTool(repo, token, name, args) {
  if(!["list_queue","get_caps"].includes(name)) throw Object.assign(new Error("Unsupported queue tool."),{status:400,code:"unknown_tool"});
  if (!hasRunDelegation(token)) throw Object.assign(new Error("Run delegation required."), {status:403,code:"run_forbidden"});
  const workspaceId = String(args.workspace_id || "");
  const world = token.runDelegation.workspaceWorlds[workspaceId];
  if (!world || !token.workspaceIds.includes(workspaceId) || !await repo.userCanAccess(token.userId,workspaceId)) throw Object.assign(new Error("Workspace not delegated."),{status:403,code:"workspace_forbidden"});
  if(args.world!==undefined && args.world!==world) throw Object.assign(new Error("World does not match delegated workspace."),{status:403,code:"world_mismatch"});
  const envelope = {workspace_id:workspaceId,world};
  const records = await repo.listRunItems(workspaceId,token.userId,world);
  if (records.length >= 2000) throw Object.assign(new Error("Workspace exceeds the safe complete-read limit; do not infer caps from a partial list."),{status:409,code:"incomplete_snapshot"});
  const rows = records.filter((row)=>row.workspaceId===workspaceId && row.userId===token.userId && row.runWorld===world);
  const items = rows.map((row)=>runDocToDeskItem(row.id,row,{id:workspaceId})).filter(Boolean);
  const counts = queueCounts(items,{workspace:world});
  if (name === "get_caps") return {...envelope,caps:DEFAULT_CAPS,counts:{...counts,p1:p1Alive(items,{workspace:world}).length,admin:adminOpen(items,{workspace:world}).length}};
  const decision = {make:"make",decide:"decide",follow_up:"follow_up",admin_batch:"admin_batch",delegated:"delegate"}[args.queue];
  if(args.queue && !decision) throw Object.assign(new Error("Unknown Run queue."),{status:400,code:"invalid_queue"});
  const active = rows.filter((row)=>!["done","completed","archived","deleted","cancelled"].includes(row.status) && (!decision || row.runDecision===decision)).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const since = args.since ? Date.parse(args.since) : null;
  if (since !== null && !Number.isFinite(since)) throw Object.assign(new Error("since must be an ISO timestamp."), {status:400,code:"invalid_since"});
  const filtered = active.filter((row)=>since===null || Date.parse(row.updatedAt)>=since);
  const size=Math.max(1,Math.min(200,Number(args.page_size)||50));
  const cursor=Math.max(0,Number(args.cursor)||0);
  const fields = Array.isArray(args.fields) ? args.fields : ["id","title","decision","priority","epic","deliverable","nextStep"];
  const result=filtered.slice(cursor,cursor+size).map((row)=>{
    const publicRow={id:row.id,workspace_id:workspaceId,world,title:row.title,external_id:row.externalId,lane:row.runLane,decision:row.runDecision,priority:row.priority,epic:row.epic,feature:row.feature,context:row.runContext,deliverable:row.runDeliverable,doneWhen:row.runDoneWhen,nextStep:row.runNextStep,source:row.runSource,dueDate:row.dueDate,owner:row.assigneeName,status:row.status};
    return Object.fromEntries(Object.entries(publicRow).filter(([key])=>["workspace_id","world"].includes(key)||fields.includes(key)));
  });
  return {...envelope,items:result,total:filtered.length,next_cursor:cursor+size<filtered.length?cursor+size:null};
}

export function validateRunDraft(input) {
  if (!checkTitle(String(input.title||"")).ok) throw Object.assign(new Error("Title needs 1–12 words, without dates, stars or prefixes."),{status:400,code:"invalid_title"});
  if (!["commercial","projects","admin"].includes(input.lane) || !["make","decide","delegate","follow_up","admin_batch"].includes(input.decision) || input.lane==="admin" && input.decision==="make") throw Object.assign(new Error("Invalid lane/decision; admin is never Make."),{status:400,code:"invalid_run_item"});
  for (const key of ["epic","context","deliverable","doneWhen","nextStep","source"]) if (typeof input[key]!=="string" || !input[key].trim()) throw Object.assign(new Error(`Required field: ${key}`),{status:400,code:"missing_run_field"});
}

export async function mutateRunItem(repo,token,name,args,now) {
  const allowed=new Set(["workspace_id","world","item_id","title","external_id","lane","decision","epic","feature","context","deliverable","doneWhen","done_when","nextStep","next_step","source","owner","dueDate","due_date","priority","outcome","evidence_source_id","dry_run","comment","text","tags","status"]);
  if(Object.keys(args).some(key=>!allowed.has(key))) throw Object.assign(new Error("Unsupported Run field; no fields were changed."),{status:400,code:"unsupported_field"});
  if(args.status!==undefined && args.status!=="done") throw Object.assign(new Error("Only evidenced completion is supported as a status change."),{status:400,code:"invalid_status"});
  if(name==="create_item" && (args.status!==undefined || args.outcome!==undefined)) throw Object.assign(new Error("Create an open item, then complete it with evidence."),{status:400,code:"invalid_status"});
  const workspaceId=String(args.workspace_id||"");
  const world=token.runDelegation?.workspaceWorlds?.[workspaceId];
  if(args.world!==undefined && args.world!==world) throw Object.assign(new Error("World does not match delegated workspace."),{status:403,code:"world_mismatch"});
  if(!hasRunDelegation(token)||!world||token.permission!=="read-write"||!await repo.userCanAccess(token.userId,workspaceId)) throw Object.assign(new Error("Run write not delegated."),{status:403,code:"forbidden"});
  if(typeof repo.mutateRun!=="function") throw Object.assign(new Error("Atomic Run storage is unavailable."),{status:503,code:"unavailable"});
  // Stable IDs make retries idempotent; generated credentials never enter logs.
  const key=String(args.external_id||"");
  if(name==="create_item"&&!key) throw Object.assign(new Error("external_id is required."),{status:400,code:"external_id_required"});
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${token.userId}|${workspaceId}|${key}`));
  const id=name==="create_item"?`run_${Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("")}`:String(args.item_id||"");
  return repo.mutateRun(workspaceId, async(records)=>{
    if(records.length>2000) throw Object.assign(new Error("Incomplete workspace snapshot."),{status:409,code:"incomplete_snapshot"});
    if(name==="create_item"&&records.some(row=>row.workspaceId===workspaceId&&row.userId===token.userId&&!row.runWorld&&row.externalId===key)) throw Object.assign(new Error("A matching legacy item exists. Do not recreate it in Run."),{status:409,code:"legacy_conflict"});
    if(name==="create_item"&&records.some(row=>row.workspaceId===workspaceId&&row.userId===token.userId&&row.runWorld&&row.runWorld!==world&&row.externalId===key)) throw Object.assign(new Error("That source ID already belongs to another world in this workspace."),{status:409,code:"external_id_conflict"});
    const rows=records.filter(row=>row.workspaceId===workspaceId&&row.userId===token.userId&&row.runWorld===world);
    const current=rows.find(row=>name==="create_item"?row.externalId===key:row.id===id);
    if(name==="create_item"&&current) return {value:{workspace_id:workspaceId,world,item_id:current.id,created:false},writes:[]};
    if(name!=="create_item"&&!current) throw Object.assign(new Error("Run item not found in the delegated world."),{status:403,code:"forbidden"});
    const input={title:args.title,lane:args.lane,decision:args.decision,epic:args.epic,context:args.context,deliverable:args.deliverable,doneWhen:args.doneWhen||args.done_when,nextStep:args.nextStep||args.next_step,source:args.source};
    let next;
    if(name==="create_item") {
      validateRunDraft(input);
      next={id,workspaceId,userId:token.userId,createdBy:token.userId,createdAt:new Date(now).toISOString(),title:input.title,workItemType:"pbi",type:"pbi",itemType:"pbi",externalId:key,runWorld:world,runLane:input.lane,runDecision:input.decision,runContext:input.context,runDeliverable:input.deliverable,runDoneWhen:input.doneWhen,runNextStep:input.nextStep,runSource:input.source,epic:input.epic,feature:String(args.feature||""),priority:args.priority||"P2",status:"open",visibility:"private",tags:Array.isArray(args.tags)?args.tags.filter(tag=>typeof tag==="string"):[],dueDate:String(args.dueDate||args.due_date||""),assigneeName:String(args.owner||"")};
      if(!next.dueDate||!next.assigneeName) next.tags=Array.from(new Set([...next.tags,"needs-info"]));
    } else {
      next={...current};
      if(args.title!==undefined&&args.title!==current.title || args.external_id!==undefined&&args.external_id!==current.externalId) throw Object.assign(new Error("Existing titles and external IDs cannot be changed by this delegation."),{status:403,code:"immutable_field"});
      if(args.priority!==undefined&&args.priority!==current.priority) throw Object.assign(new Error("Priority changes require a proposal."),{status:403,code:"proposal_required"});
      const fields={decision:"runDecision",lane:"runLane",epic:"epic",feature:"feature",context:"runContext",deliverable:"runDeliverable",doneWhen:"runDoneWhen",done_when:"runDoneWhen",nextStep:"runNextStep",next_step:"runNextStep",source:"runSource",owner:"assigneeName",dueDate:"dueDate",due_date:"dueDate"};
      for(const [key,field] of Object.entries(fields)) if(args[key]!==undefined) next[field]=String(args[key]);
      if(args.tags!==undefined) {
        if(!Array.isArray(args.tags)||args.tags.some(tag=>typeof tag!=="string")) throw Object.assign(new Error("tags must be strings."),{status:400,code:"invalid_tags"});
        next.tags=args.tags;
      }
      if(args.outcome!==undefined||args.status==="done") {
        const outcome=typeof args.outcome==="object"?args.outcome.kind:args.outcome;
        if((outcome||"done")!=="done") throw Object.assign(new Error("Drop and renegotiation require proposals."),{status:403,code:"proposal_required"});
        if(!args.evidence_source_id) throw Object.assign(new Error("Completion requires evidence_source_id."),{status:400,code:"evidence_required"});
        next.status="done";next.runOutcome={kind:"done",at:new Date(now).toISOString(),sourceId:String(args.evidence_source_id)};
      }
      if(name==="add_comment") {
        const message=String(args.comment||args.text||"").trim();
        if(!message||message.length>5000) throw Object.assign(new Error("comment must contain 1–5000 characters."),{status:400,code:"invalid_comment"});
        next.comments=[...(current.comments||[]),{text:message,at:new Date(now).toISOString(),by:token.userId,agent:token.name}].slice(-200);
      }
    }
    validateRunDraft({title:next.title,lane:next.runLane,decision:next.runDecision,epic:next.epic,context:next.runContext,deliverable:next.runDeliverable,doneWhen:next.runDoneWhen,nextStep:next.runNextStep,source:next.runSource});
    if(!["P1","P2","P3","P4"].includes(next.priority)) throw Object.assign(new Error("priority must be P1–P4."),{status:400,code:"invalid_priority"});
    if(next.dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(next.dueDate)) throw Object.assign(new Error("Invalid due date."),{status:400,code:"invalid_date"});
    const items=rows.map(row=>runDocToDeskItem(row.id,row,{id:workspaceId})).filter(Boolean);
    if(next.status!=="done") {
      const checks=[next.runDecision==="make"?checkMoveToMake(items,{workspace:world},id):{ok:true},next.runLane==="admin"?checkAdminWrite(items,{workspace:world},id):{ok:true},checkSetPriority(items,{workspace:world},id,next.priority)];
      const failed=checks.find(check=>!check.ok);
      if(failed) throw Object.assign(new Error(`Cap reached: ${failed.code}`),{status:409,code:"cap_exceeded",current:failed.current});
    }
    next.updatedAt=new Date(now).toISOString();
    const value={workspace_id:workspaceId,world,item_id:id,external_id:next.externalId,created:name==="create_item",dry_run:args.dry_run===true};
    if(args.dry_run===true) return {value,writes:[]};
    const auditId=`run_audit_${crypto.randomUUID()}`;
    return {value,writes:[{collection:"tasks",id,data:Object.fromEntries(Object.entries(next).filter(([key])=>key!=="id"))},{collection:"mcp_audit_events",id:auditId,data:{userId:token.userId,tokenId:token.id,tokenName:token.name,workspaceId,world,itemId:id,action:name,at:next.updatedAt,sourceId:args.evidence_source_id||next.externalId}}]};
  },{ownerId:token.userId,world,legacyExternalId:name==="create_item"?key:undefined});
}

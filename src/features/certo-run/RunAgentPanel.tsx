import { useCallback, useEffect, useState } from "react";
import { auth } from "../../lib/firebase";
import { useLocale } from "../../lib/useLocale";

export type AgentProposal = {id:string;itemTitle:string;action:string;value:string;reason:string;evidenceSourceId:string;status:string};
export type AgentSnapshot = {
  workspace_id:string;world:string;items:Array<Record<string,unknown>&{id:string}>;
  control:{proposals:AgentProposal[];briefs:Array<{date:string;kind:string;body:string;recordedAt:string;sourceIds:string[]}>;sync:{revision:number;state:{last_run_at?:string};logs:Array<{at:string;summary:string;failed_sources:string[]}>}};
};
export async function runOwnerRequest(path:string,body?:Record<string,unknown>) {
  if(!auth.currentUser)throw new Error("Sign in to Certo Work first.");
  const idToken=await auth.currentUser.getIdToken();
  const response=await fetch(path,{method:body?"POST":"GET",headers:{authorization:`Bearer ${idToken}`,...(body?{"content-type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store"});
  const payload=await response.json();
  if(!response.ok)throw new Error(payload.message||payload.code||"Run request failed.");
  return payload;
}
export function useRunAgentSnapshot(world:string) {
  const [result,setResult]=useState<{world:string;data:AgentSnapshot}|null>(null);
  const [error,setError]=useState("");
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(value=>value+1),[]);
  useEffect(()=>{
    let active=true;
    setError("");
    if(world==="Personal")return;
    void runOwnerRequest(`/api/run/agent/snapshot?world=${encodeURIComponent(world)}`).then(data=>{
      if(active&&data.world===world)setResult({world,data});
    }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:"Could not load Run.");});
    return ()=>{active=false;};
  },[world,revision]);
  return {snapshot:result?.world===world?result.data:null,error,refresh};
}
export function RunAgentPanel({snapshot,tab,decide,onRefresh,onOpenDecide,onReview=runOwnerRequest}:{snapshot:AgentSnapshot;tab:string;decide:boolean;onRefresh:()=>void;onOpenDecide?:()=>void;onReview?:typeof runOwnerRequest}) {
  const locale=useLocale();
  const copy=locale==="es"?COPY.es:COPY.en;
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const pending=snapshot.control.proposals.filter(row=>row.status==="pending");
  const brief=snapshot.control.briefs[snapshot.control.briefs.length-1];
  const log=snapshot.control.sync.logs[snapshot.control.sync.logs.length-1];
  async function review(proposal_id:string,decision:string) {
    setBusy(true);setError("");
    try{await onReview("/api/run/agent/review",{workspace_id:snapshot.workspace_id,world:snapshot.world,proposal_id,decision});onRefresh();}
    catch(reason){setError(reason instanceof Error?reason.message:copy.failed);}
    finally{setBusy(false);}
  }
  if(tab!=="today"&&!(tab==="queue"&&decide))return null;
  return <section className="cr-agent-panel" aria-label={copy.title}>
    <header><div><h2>{copy.title}</h2><p>{snapshot.world} · {pending.length} {copy.pending}</p></div><button className="cr-tool" type="button" onClick={onRefresh} disabled={busy}>{copy.refresh}</button></header>
    {error&&<p role="alert" className="cr-flag">{error}</p>}
    {tab==="today"&&<>
      {pending.length>0&&onOpenDecide&&<button className="cr-solid" type="button" onClick={onOpenDecide}>{copy.review}</button>}
      {brief?<article className="cr-agent-brief"><p className="cr-muted">{brief.date} · {brief.kind==="morning"?copy.morning:copy.midday}</p><h3>{copy.brief}</h3><div className="cr-agent-copy">{brief.body}</div><small>{brief.sourceIds.length} {copy.sources}</small></article>:<p className="cr-muted">{copy.noBrief}</p>}
      {log?<details><summary>{copy.lastSync} · {snapshot.control.sync.state.last_run_at||log.at}</summary><p className="cr-agent-copy">{log.summary}</p>{log.failed_sources.length>0&&<p role="status">{copy.failedSources}: {log.failed_sources.join(" · ")}</p>}</details>:<p className="cr-muted">{copy.noSync}</p>}
    </>}
    {tab==="queue"&&<div className="cr-agent-proposals">{pending.length===0?<p className="cr-muted">{copy.noProposals}</p>:pending.map(proposal=><article key={proposal.id}>
      <p className="cr-muted">{ACTIONS[locale][proposal.action]||proposal.action}</p><h3>{proposal.itemTitle}</h3>{proposal.value&&<p className="cr-agent-value">{proposal.value}</p>}<p>{proposal.reason}</p>
      <details><summary>{copy.evidence}</summary><p>{proposal.evidenceSourceId}</p></details>
      <div className="cr-agent-actions"><button className="cr-solid" type="button" disabled={busy} onClick={()=>void review(proposal.id,"approve")}>{copy.approve}</button><button className="cr-tool" type="button" disabled={busy} onClick={()=>void review(proposal.id,"reject")}>{copy.reject}</button></div>
    </article>)}</div>}
  </section>;
}
const COPY={
  en:{title:"Assistant updates",pending:"pending review",refresh:"Refresh",review:"Review proposals →",brief:"Daily brief",morning:"Morning",midday:"Midday",sources:"source references",noBrief:"Your assistant has not recorded a brief yet.",noSync:"No synchronization has been recorded. Sources and schedules run in Grok.",lastSync:"Last recorded sync",failedSources:"Unavailable sources",noProposals:"No proposals awaiting your review.",evidence:"Source reference",approve:"Approve",reject:"Reject",failed:"Could not review the proposal."},
  es:{title:"Novedades de tu asistente",pending:"por revisar",refresh:"Actualizar",review:"Revisar propuestas →",brief:"Resumen del día",morning:"Mañana",midday:"Mediodía",sources:"referencias de origen",noBrief:"Tu asistente todavía no ha guardado un resumen.",noSync:"No hay sincronizaciones registradas. Las fuentes y los horarios se ejecutan en Grok.",lastSync:"Última sincronización registrada",failedSources:"Fuentes no disponibles",noProposals:"No hay propuestas pendientes de revisión.",evidence:"Referencia de origen",approve:"Aprobar",reject:"Rechazar",failed:"No se pudo revisar la propuesta."},
};
const ACTIONS:Record<"en"|"es",Record<string,string>>={en:{retitle:"Update title",set_priority:"Change priority",drop:"Drop commitment",mark_done:"Mark complete",renegotiate:"Renegotiate date",move_to_make:"Move to Make",delegate:"Delegate"},es:{retitle:"Actualizar título",set_priority:"Cambiar prioridad",drop:"Descartar compromiso",mark_done:"Marcar como terminado",renegotiate:"Renegociar fecha",move_to_make:"Mover a ejecución",delegate:"Delegar"}};

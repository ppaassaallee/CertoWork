import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {RunDeskView, type RunTab} from "../../src/features/certo-run/CertoRunDesk";
import {RunQueue, RunItemDrawer, type RunForm, type QueueMode} from "../../src/features/certo-run/RunQueue";
import {runDocToDeskItem} from "../../src/lib/certoRun/store";
import {setLocale} from "../../src/lib/i18n";
import {useLocale} from "../../src/lib/useLocale";
import "../../src/index.css";

// Test-only fixture. All persistence is in this component's memory, never Firebase.
const fixture=await fetch("/__run_ux_fixture").then(response=>response.json());
function ActionHarness(){
  useLocale();
  const [rows,setRows]=useState(fixture),[selected,setSelected]=useState<string|null>(null),[form,setForm]=useState<RunForm>(null),[mode,setMode]=useState<QueueMode>("make");
  const items=rows.map((row:Record<string,unknown>&{id:string})=>runDocToDeskItem(row.id,row,{id:"visual-workspace"})).filter(Boolean);
  const item=items.find((row: {id:string})=>row.id===selected);
  const counts={make:items.length,decide:items.length,owed:items.length,admin:items.length,delegated:items.length,unsorted:0};
  function patch(id:string,data:Record<string,unknown>){setRows((old:typeof fixture)=>old.map((row:Record<string,unknown>&{id:string})=>row.id===id?{...row,...data}:row));}
  const actions={busy:false,onDone:(id:string)=>setRows((old:typeof fixture)=>old.filter((row:{id:string})=>row.id!==id)),onNo:(id:string)=>setRows((old:typeof fixture)=>old.filter((row:{id:string})=>row.id!==id)),onMake:()=>setMode("make"),onPostpone:()=>{},onDrop:(id:string)=>{setSelected(id);setForm({id,kind:"drop"});},onForm:(next:RunForm)=>{if(next)setSelected(next.id);setForm(next);}};
  return <section className="cr-desk"><RunQueue mode={mode} counts={counts} items={items} actions={actions} onMode={setMode} onOpen={setSelected} onIntake={()=>{}} />
    {item&&<RunItemDrawer item={item} actions={actions} form={form} onClose={()=>{setSelected(null);setForm(null);}} onSave={value=>{
      if(form?.kind==="date")patch(item.id,{dueDate:value.date});
      if(form?.kind==="delegate")patch(item.id,{assigneeName:value.who,runDecision:"delegate"});
      if(form?.kind==="drop")actions.onDone(item.id);
      setForm(null);
    }}/>}
  </section>;
}
function Harness(){
  const [tab,setTab]=useState<RunTab>("queue");
  return <div className="do-shell"><main className="do-main is-run-module" style={{gridColumn:"1 / -1",minWidth:0,height:"100dvh"}}>
    <nav aria-label="Test language"><button onClick={()=>setLocale("en")}>English</button><button onClick={()=>setLocale("es")}>Español</button></nav>
    {new URLSearchParams(location.search).has("actions")?<ActionHarness/>:<RunDeskView rows={fixture} workspaceId="visual-workspace" user={{uid:"visual-owner",displayName:"Alex"}} tab={tab} onTab={setTab} onBack={()=>{}}/>}
  </main></div>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);

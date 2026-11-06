import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {RunAgentPanel,type AgentSnapshot} from "../../src/features/certo-run/RunAgentPanel";
import {setLocale} from "../../src/lib/i18n";
import "../../src/features/certo-run/certo-run.css";
import "../../src/index.css";
import "../../src/run/styles/tokens.css";
// Test-only, not part of the production entry. Never calls live Firebase.
const fixture:AgentSnapshot=await fetch("/__agent_fixture").then(response=>response.json());
function Harness(){
  const [snapshot,setSnapshot]=useState(fixture),[tab,setTab]=useState("today");
  return <div className="do-shell"><main className="do-main is-run-module" style={{gridColumn:"1 / -1",minWidth:0}}><section className="cr-desk" style={{padding:24,minHeight:"100vh"}}>
    <nav><button onClick={()=>setTab("today")}>Today</button><button onClick={()=>setTab("queue")}>Decide</button><button onClick={()=>setLocale("es")}>Español</button></nav>
    <RunAgentPanel snapshot={snapshot} tab={tab} decide onRefresh={()=>{}} onReview={async(path,body)=>{
      const response=await fetch(path,{method:"POST",body:JSON.stringify(body)});const result=await response.json();
      if(!response.ok)throw new Error(result.message);
      setSnapshot(current=>({...current,control:{...current.control,proposals:current.control.proposals.filter(row=>row.id!==body?.proposal_id)}}));return result;
    }}/>
  </section></main></div>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);

import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { firestoreRunTransaction } from "../worker/firestoreAdmin.js";

test("REST Run transaction retries conflicts, atomically commits item/audit, rolls back errors",async()=>{
  // Disposable test-only signer. No real credentials or network requests.
  const {privateKey}=generateKeyPairSync("rsa",{modulusLength:2048,privateKeyEncoding:{type:"pkcs8",format:"pem"},publicKeyEncoding:{type:"spki",format:"pem"}});
  const env={FIREBASE_SERVICE_ACCOUNT:JSON.stringify({client_email:"test@example.invalid",private_key:privateKey}),FIREBASE_PROJECT_ID:"test",FIRESTORE_DATABASE_ID:"test-db"};
  const original=globalThis.fetch;
  const calls:{url:string;body:Record<string,unknown>}[]=[];
  let commits=0,builds=0;
  globalThis.fetch=async(url,options)=>{
    const address=String(url);
    if(address.includes("oauth2.googleapis.com"))return Response.json({access_token:"fake",expires_in:3600});
    const body=JSON.parse(String(options?.body||"{}"));calls.push({url:address,body});
    if(address.endsWith(":beginTransaction"))return Response.json({transaction:"dHg="});
    if(address.endsWith(":runQuery"))return Response.json([{document:{name:"projects/test/databases/test-db/documents/tasks/item",fields:{workspaceId:{stringValue:"work"},title:{stringValue:"Existing item"}}}}]);
    if(address.endsWith(":batchGet"))return Response.json([{missing:"projects/test/databases/test-db/documents/run_agent_state/control"}]);
    if(address.endsWith(":commit"))return ++commits===1?Response.json({error:{status:"ABORTED"}},{status:409}):Response.json({commitTime:"2026-11-06T12:00:00Z"});
    if(address.endsWith(":rollback"))return Response.json({});
    throw new Error(`Unexpected test request ${address}`);
  };
  try{
    const result=await firestoreRunTransaction(env,"work",async rows=>{
      builds++;assert.equal(rows[0].title,"Existing item");
      return {value:{ok:true},writes:[{collection:"tasks",id:"new",data:{title:"New item"}},{collection:"mcp_audit_events",id:"audit",data:{itemId:"new"}}]};
    });
    assert.deepEqual(result,{ok:true});assert.equal(builds,2);
    const commitCalls=calls.filter(call=>call.url.endsWith(":commit"));
    assert.equal((commitCalls[1].body.writes as unknown[]).length,2);
    assert.equal(calls.filter(call=>call.url.endsWith(":rollback")).length,1);
    assert.equal(calls.find(call=>call.url.endsWith(":runQuery"))?.body.transaction,"dHg=");
    await assert.rejects(firestoreRunTransaction(env,"work",async()=>{throw new Error("cap refused");}),/cap refused/);
    assert.equal(commits,2);assert.equal(calls.filter(call=>call.url.endsWith(":rollback")).length,2);
    const queries=calls.filter(call=>call.url.endsWith(":runQuery")).length;
    await firestoreRunTransaction(env,"work",async(rows,control)=>{
      assert.deepEqual(rows,[]);assert.equal(control,null);
      return {value:{saved:true},writes:[{collection:"run_agent_state",id:"control",data:{world:"Pure AI"}}]};
    },{controlId:"control",readItems:false});
    assert.equal(calls.filter(call=>call.url.endsWith(":runQuery")).length,queries);
    assert.equal(calls.find(call=>call.url.endsWith(":batchGet"))?.body.transaction,"dHg=");
  }finally{globalThis.fetch=original;}
});

import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {handleWorkerMcp} from "../worker/mcp/remoteHttp.js";

test("owner review rejects MCP bearer tokens, foreign people and unverified identities before accessing storage",async()=>{
  const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
  const jwk={...publicKey.export({format:"jwk"}),kid:"test",alg:"RS256",use:"sig"};
  const original=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async url=>{
    requests++;
    assert.match(String(url),/securetoken@system\.gserviceaccount\.com/);
    return Response.json({keys:[jwk]});
  };
  const env={FIREBASE_SERVICE_ACCOUNT:JSON.stringify({client_email:"test@example.invalid",private_key:"not-used"})};
  function jwt(email:string,verified:boolean){
    const now=Math.floor(Date.now()/1000);
    const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString("base64url");
    const text=`${encode({alg:"RS256",kid:"test"})}.${encode({sub:"owner",aud:"gen-lang-client-0277783597",iss:"https://securetoken.google.com/gen-lang-client-0277783597",iat:now,exp:now+300,email,email_verified:verified})}`;
    return `${text}.${sign("RSA-SHA256",Buffer.from(text),privateKey).toString("base64url")}`;
  }
  async function request(token:string){
    const url=new URL("https://certo.work/api/run/agent/review");
    return handleWorkerMcp(new Request(url,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({world:"Pure AI",proposal_id:"p",decision:"approve"})}),env,url);
  }
  try{
    assert.equal((await request("cw_mcp_not_a_human_identity"))?.status,401);
    assert.equal((await request(jwt("other@example.com",true)))?.status,403);
    assert.equal((await request(jwt("alejandro@getboldr.ai",false)))?.status,403);
    assert.equal(requests,2);
  }finally{globalThis.fetch=original;}
});

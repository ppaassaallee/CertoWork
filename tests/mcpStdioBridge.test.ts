import test from "node:test";
import assert from "node:assert/strict";
import {Readable,Writable} from "node:stream";
import {createCertoBridge,serveCertoStdio,CERTO_MCP_URL} from "../scripts/certo-mcp-stdio.mjs";
const secret=`cw_mcp_${"test_fixture_only_".repeat(3)}`;
const request=(id:number,method="initialize")=>JSON.stringify({jsonrpc:"2.0",id,method});

test("stdio forwards JSON and SSE, retains negotiated version, never configures a UA or alternate endpoint",async()=>{
  const calls:Array<{url:string;options:RequestInit}>=[];
  const bridge=createCertoBridge({env:{CERTO_MCP_TOKEN:secret},fetchImpl:async(url,options)=>{
    calls.push({url,options});
    if(calls.length===1)return Response.json({jsonrpc:"2.0",id:1,result:{protocolVersion:"2025-06-18"}},{headers:{"mcp-session-id":"test-session"}});
    return new Response(`event: message\r\ndata: ${JSON.stringify({jsonrpc:"2.0",id:2,result:{tools:[]}})}\r\n\r\n`,{headers:{"content-type":"text/event-stream"}});
  }});
  assert.equal((await bridge.handleLine(request(1)))[0].result.protocolVersion,"2025-06-18");
  assert.deepEqual((await bridge.handleLine(request(2,"tools/list")))[0].result,{tools:[]});
  assert.equal(calls[0].url,CERTO_MCP_URL);assert.equal(calls[0].options.redirect,"manual");
  const headers=calls[1].options.headers as Record<string,string>;
  assert.equal(headers.authorization,`Bearer ${secret}`);assert.equal(headers["mcp-protocol-version"],"2025-06-18");assert.equal(headers["mcp-session-id"],"test-session");
  assert.equal(Object.keys(headers).some(key=>key.toLowerCase()==="user-agent"),false);
});
test("missing runtime credential makes no request and never searches credential files",async()=>{
  let calls=0;
  const bridge=createCertoBridge({env:{},fetchImpl:async()=>{calls++;return Response.json({});}});
  const result=await bridge.handleLine(request(1));
  assert.equal(result[0].error.data.code,"missing_credential");assert.equal(calls,0);assert.equal(bridge.isStopped(),true);
});
test("security denial latches the adapter stopped; there is no retry, redirect or identifier workaround",async()=>{
  for(const status of [401,403,302]) {
    let calls=0;
    const bridge=createCertoBridge({env:{CERTO_MCP_TOKEN:secret},fetchImpl:async()=>{calls++;return new Response("sensitive response body",{status,headers:{"cf-ray":"example-ray"}});}});
    const denied=await bridge.handleLine(request(1));
    assert.equal(denied[0].error.data.http_status,status);assert.equal(bridge.isStopped(),true);
    assert.match(denied[0].error.message,new RegExp(`HTTP ${status}`));
    assert.match(denied[0].error.message,/CF-Ray example-ray/);
    await bridge.handleLine(request(2));assert.equal(calls,1);assert.equal(JSON.stringify(denied).includes("sensitive response body"),false);
  }
});
test("credential echo and exception details cannot enter tool output",async()=>{
  const bridge=createCertoBridge({env:{CERTO_MCP_TOKEN:secret},fetchImpl:async()=>Response.json({jsonrpc:"2.0",id:1,result:{unexpected:secret}})});
  assert.equal(JSON.stringify(await bridge.handleLine(request(1))).includes(secret),false);
  const failing=createCertoBridge({env:{CERTO_MCP_TOKEN:secret},fetchImpl:async()=>{throw new Error(secret);}});
  assert.equal(JSON.stringify(await failing.handleLine(request(1))).includes(secret),false);
});
test("notifications produce no stdout response; stdio emits only complete JSON-RPC lines",async()=>{
  const bridge=createCertoBridge({env:{CERTO_MCP_TOKEN:secret},fetchImpl:async(_url,options)=>{
    const message=JSON.parse(String(options.body));
    return message.id?Response.json({jsonrpc:"2.0",id:message.id,result:{ok:true}}):new Response(null,{status:202});
  }});
  const output:string[]=[];
  const code=await serveCertoStdio({bridge,input:Readable.from([`${request(1)}\n${JSON.stringify({jsonrpc:"2.0",method:"notifications/initialized"})}\n${request(2,"tools/list")}\n`]),output:new Writable({write(chunk,_encoding,done){output.push(String(chunk));done();}})});
  assert.equal(code,0);assert.deepEqual(output.map(line=>JSON.parse(line).id),[1,2]);
  assert.equal(output.join("").includes(secret),false);
});
test("parse errors and mismatched response IDs fail without leaking payloads",async()=>{
  const bridge=createCertoBridge({env:{CERTO_MCP_TOKEN:secret},fetchImpl:async()=>Response.json({jsonrpc:"2.0",id:99,result:{}})});
  assert.equal((await bridge.handleLine("not-json"))[0].error.code,-32700);
  assert.equal((await bridge.handleLine(request(1)))[0].error.code,-32000);
});

#!/usr/bin/env node
/** Certo-only stdio adapter. No dependencies, credential files, retries or UA overrides. */
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

export const CERTO_MCP_URL = "https://certo.work/mcp";
const LIMIT = 2 * 1024 * 1024;
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const rpcError = (id, code, message, data) => ({jsonrpc:"2.0",id:id??null,error:{code,message,...(data?{data}:{})}});

export function createCertoBridge({env=process.env,fetchImpl=fetch}={}) {
  let protocol="", session="", stopped=false;
  function token() {
    const value=String(env.CERTO_MCP_TOKEN||"").trim();
    if(!/^cw_mcp_[A-Za-z0-9_-]{16,2048}$/.test(value))throw new Error("missing_credential");
    return value;
  }
  function clean(value,secret) {return String(value).split(secret).join("[REDACTED]");}
  async function handleLine(line) {
    let request;
    try {
      if(Buffer.byteLength(line,"utf8")>LIMIT)return [rpcError(null,-32600,"Message exceeds the adapter limit.")];
      request=JSON.parse(line);
    } catch {return [rpcError(null,-32700,"Invalid JSON.")];}
    if(!request||Array.isArray(request)||request.jsonrpc!=="2.0"||!(typeof request.method==="string"||owns(request,"id")&&(owns(request,"result")||owns(request,"error"))))return [rpcError(null,-32600,"Invalid JSON-RPC message.")];
    const expectsReply=owns(request,"id")&&typeof request.method==="string";
    const reply=payload=>expectsReply?[payload]:[];
    if(stopped)return reply(rpcError(request.id,-32001,"Connection stopped. Review its credentials or security policy before restarting."));
    let secret;
    try {secret=token();}
    catch {stopped=true;return reply(rpcError(request.id,-32001,"CERTO_MCP_TOKEN is missing from this registered process. Supply the existing secret through the approved runtime environment; never paste it into chat or arguments.",{code:"missing_credential"}));}
    try {
      const headers={authorization:`Bearer ${secret}`,"content-type":"application/json",accept:"application/json, text/event-stream"};
      if(protocol)headers["mcp-protocol-version"]=protocol;
      if(session)headers["mcp-session-id"]=session;
      const response=await fetchImpl(CERTO_MCP_URL,{method:"POST",headers,body:JSON.stringify(request),redirect:"manual",signal:AbortSignal.timeout(30000)});
      if(!response.ok) {
        // No retries, browser impersonation, alternate origins or redirect following.
        if([401,403].includes(response.status)||response.status>=300&&response.status<400)stopped=true;
        const ray=clean(response.headers.get("cf-ray")||"",secret).replace(/[^A-Za-z0-9_-]/g,"").slice(0,80);
        // Some clients discard error.data: retain safe diagnostics in the message too.
        return reply(rpcError(request.id,-32000,`Certo HTTP ${response.status}${ray?` (CF-Ray ${ray})`:""}. Stopped on security denial/redirect; do not bypass security blocks.`,{http_status:response.status,cf_ray:ray}));
      }
      if(response.status===202)return [];
      const body=clean(await response.text(),secret);
      if(Buffer.byteLength(body,"utf8")>LIMIT)return reply(rpcError(request.id,-32000,"Certo response exceeds the adapter limit."));
      const events=response.headers.get("content-type")?.includes("text/event-stream")
        ? body.replace(/\r\n/g,"\n").split(/\n\n+/).map(event=>event.split("\n").filter(row=>row.startsWith("data:")).map(row=>row.slice(5).trimStart()).join("\n")).filter(Boolean)
        : [body];
      const messages=events.map(event=>JSON.parse(event));
      for(const message of messages) {
        if(message?.jsonrpc!=="2.0")throw new Error("invalid_response");
        if(owns(message,"id")&&!message.method&&message.id!==request.id)throw new Error("invalid_response");
        if(request.method==="initialize"&&message.result) {
          protocol=String(message.result.protocolVersion||"");
          session=response.headers.get("mcp-session-id")||"";
        }
      }
      return messages;
    } catch {return reply(rpcError(request.id,-32000,"Certo transport failed or returned an invalid response. No automatic retry was performed."));}
  }
  return {handleLine,isStopped:()=>stopped};
}

export async function serveCertoStdio({input=process.stdin,output=process.stdout,bridge=createCertoBridge()}={}) {
  const lines=createInterface({input,crlfDelay:Infinity});
  // Sequential calls avoid reconnect/retry storms. stdout contains JSON-RPC only.
  for await(const line of lines) {
    if(!line.trim())continue;
    for(const message of await bridge.handleLine(line))output.write(`${JSON.stringify(message)}\n`);
    if(bridge.isStopped()) {lines.close();input.pause();break;}
  }
  return bridge.isStopped()?1:0;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  serveCertoStdio().then(code=>{process.exitCode=code;}).catch(()=>{
    process.stderr.write("Certo stdio adapter stopped. No credentials were logged.\n");process.exitCode=1;
  });
}

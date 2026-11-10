import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import ts from "typescript";
import {RUN_ES,runText,runError,runDate} from "../src/features/certo-run/runCopy";
import {setLocale} from "../src/lib/localeStore";
import {GATE_QUESTIONS} from "../src/lib/certoRun/intake";
import {MOOD_KEYS,STAGES} from "../src/lib/certoRun/vocab";
import {DEFAULT_MANIFESTO} from "../src/lib/certoRun/manifesto";
test("Run product copy and accessibility labels have explicit Spanish translations",()=>{
  const missing=new Set<string>();
  for(const name of readdirSync("src/features/certo-run").filter(name=>name.endsWith(".tsx"))){
    const file=ts.createSourceFile(name,readFileSync(`src/features/certo-run/${name}`,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    function visit(node:ts.Node){
      if(ts.isCallExpression(node)&&node.expression.getText(file)==="t"&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])&&!RUN_ES[node.arguments[0].text])missing.add(node.arguments[0].text);
      if(ts.isJsxText(node)&&/[A-Za-z]/.test(node.text))missing.add(`untranslated JSX: ${node.text.trim()}`);
      ts.forEachChild(node,visit);
    }visit(file);
  }
  assert.deepEqual([...missing],[]);
});
test("gate, stage, check-in and default manifesto copy is bilingual without modifying source data",()=>{
  for(const question of GATE_QUESTIONS)for(const value of [question.question,question.hint,question.no.name,question.no.detail])assert.ok(RUN_ES[value],value);
  for(const value of [...STAGES,...MOOD_KEYS.map(key=>key.replace("_"," ")),DEFAULT_MANIFESTO])assert.ok(RUN_ES[value],value);
  assert.equal(runText("Actions for {title}",{title:"Client's original title"},"es"),"Acciones de Client's original title");
  assert.equal(runText("Client's original title",{},"es"),"Client's original title");
});
test("validation translates system wording but retains record paths and source identifiers",()=>{
  assert.equal(runError("items[3]: invalid world.","es"),"items[3]: mundo no válido.");
  assert.match(runError("items[1]: duplicate external_id MAIL-123.","es"),/external_id duplicado MAIL-123/);
  assert.equal(runError("Expected a JSON object.","es"),"Se esperaba un objeto JSON.");
  assert.equal(runError("Expected a JSON object.","en"),"Expected a JSON object.");
});
test("date labels follow the selected locale without changing civil dates",()=>{
  try{setLocale("en");assert.equal(runDate("2026-11-12"),"Nov 12");setLocale("es");assert.match(runDate("2026-11-12"),/12/);assert.notEqual(runDate("2026-11-12"),"Nov 12");}finally{setLocale("en");}
});
test("queue/search/drawer add no data subscriptions or AI dependencies",()=>{
  for(const name of ["RunQueue.tsx","RunCommand.tsx","RunDialog.tsx"]){const source=readFileSync(`src/features/certo-run/${name}`,"utf8");assert.doesNotMatch(source,/onSnapshot|firebase|openai|genai|fetch\(/);}
  const pkg=JSON.parse(readFileSync("package.json","utf8"));assert.equal(pkg.dependencies.react,"^18.3.1");assert.equal(pkg.dependencies["@astryxdesign/core"],undefined);
});

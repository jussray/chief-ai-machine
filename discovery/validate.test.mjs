import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, graph, identities} from './validate.mjs';
function checks(m, identities, implementation, graphImplementation) {
 let passed=0;
 function check(condition,label){if(!condition) throw Error(label);passed++}
 const copy=()=>JSON.parse(JSON.stringify(m));
 check(implementation(m,identities)===true,"valid manifest");
 const mutations=[
   x=>x.publicationStatus="published",
   x=>x.verifiedCapabilities=["live"],
   x=>x.evidence=[{status:"VERIFIED"}],
   x=>x.token="secret",
   x=>x.url="https://private.example",
   x=>x.project="__proto__",
   x=>x.description="Guaranteed AI recommendation",
   x=>x.useCases.push("unapproved"),
   x=>delete x.name,
   x=>x.version="2"
 ];
 for(const mutate of mutations){const x=copy();mutate(x);let rejected=false;try{implementation(x,identities)}catch{rejected=true}check(rejected,"reject mutation")}
 const g=graphImplementation(m,identities);
 check(g["@graph"][0]["@id"]==="https://jussco.company/#organization","shared identity");
 check(g["@graph"].length===(m.project==="jussray"?2:3),"standalone product boundary");
 check(!JSON.stringify(g).includes("verifiedCapabilities"),"no capability assertions in graph");
 return passed;
}
const m=JSON.parse(readFileSync(new URL('./project.json',import.meta.url),'utf8'));
test('ADRP rejects unsupported assertions and preserves entity boundaries',()=>{assert.equal(checks(m,identities,validate,graph),14);});
test('stored draft graph is exactly generated from manifest',()=>{assert.deepEqual(JSON.parse(readFileSync(new URL('./knowledge.draft.jsonld',import.meta.url),'utf8')),graph(m,identities));});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {graph,identities} from './validate.mjs';
const read=n=>JSON.parse(readFileSync(new URL('./'+n,import.meta.url),'utf8'));
test('draft graph and capability/evidence registries cannot claim live proof',()=>{const m=read('project.json'), c=read('capabilities.json'), e=read('evidence.json');const g=graph(m,identities);assert.equal(g['@graph'][0]['@id'],'https://www.jussco.company/#organization');const p=g['@graph'].find(x=>x['@type']==='SoftwareApplication');if(p){assert.equal(p['@id'],new URL(m.url).origin+'/#application');assert.equal(p.url,m.url);}assert.deepEqual(c,{project:m.project,status:'draft',intendedUseCases:m.useCases,verifiedCapabilities:[]});assert.deepEqual(e,{project:m.project,status:'draft',productionStatus:'UNKNOWN',publicEvidence:[]});});

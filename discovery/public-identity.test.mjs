import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../front-door/worker.mjs';
const page="https://chief.foundercontrolroom.org/";
function parse(html){const m=html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);assert.ok(m);return JSON.parse(m[1]);}
test('anonymous public Worker serves stable product identity matching source',async()=>{const r=await worker.fetch(new Request(page));assert.equal(r.status,200);const g=parse(await r.text());assert.deepEqual(g,parse(readFileSync(new URL('../public-face.html',import.meta.url),'utf8')));assert.equal(g['@id'],page+'#application');assert.equal(g.publisher['@id'],'https://www.jussco.company/#organization');assert.equal((await worker.fetch(new Request(page+'discovery/project.json'))).status,404);assert.equal((await worker.fetch(new Request(page,{method:'POST'}))).status,404);});

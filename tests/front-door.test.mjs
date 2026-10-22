import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../front-door/worker.mjs';
const origin='https://chief.foundercontrolroom.org';
test('root page is the founder-approved public presentation', async () => {
  const r=await worker.fetch(new Request(origin+'/'));
  assert.equal(r.status,200);
  assert.match(await r.text(), /Chief AI.*Founder Intelligence OS/);
  assert.match(r.headers.get('Content-Security-Policy'), /script-src 'none'/);
});
test('never serve application or private APIs on this public Worker', async () => {
  for(const path of ['/api/chief/runtime-proof','/app','/admin','/counsel.html']){
    assert.equal((await worker.fetch(new Request(origin+path))).status,404,path);
  }
  assert.equal((await worker.fetch(new Request(origin+'/',{method:'POST'}))).status,404);
});
test('only exact homepage route can reach public Worker', () => {
  const cfg=JSON.parse(readFileSync(new URL('../wrangler.front-door.jsonc',import.meta.url),'utf8'));
  assert.equal(cfg.routes[0].pattern,'chief.foundercontrolroom.org/');
  assert.equal(cfg.preview_urls,false);
});

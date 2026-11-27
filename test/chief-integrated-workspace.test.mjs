/* global URLSearchParams */
import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import { handleAccount } from '../worker/account.mjs';
import { accountScene, accountPresence, accountSceneCss } from '../worker/account-visual.mjs';

const origin='https://chief.foundercontrolroom.org';
const owner='00000000-0000-4000-8000-000000000001';
const env={CHIEF_ACCOUNTS_ENABLED:'true',CHIEF_AUTH_URL:'https://test-chief.supabase.co',CHIEF_AUTH_PUBLISHABLE_KEY:'sb_publishable_test_fixture',CHIEF_FOUNDER_SUBJECT:owner};
const cookie='__Host-chief_session=aaa.bbb.ccc';
const request=(path,body,authenticated=true,source=origin)=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{...(authenticated?{cookie}:{}),...(body===undefined?{}:{origin:source,'content-type':'application/x-www-form-urlencoded'})},...(body===undefined?{}:{body})});
function fixture(calls){
 return async url=>{
   const path=new URL(url).pathname;
   calls.push(path);
   if(path==='/auth/v1/user')return Response.json({id:owner,email_confirmed_at:'2026-11-27',is_anonymous:false});
   if(path==='/rest/v1/chief_business_records')return Response.json([]);
   throw Error('UNEXPECTED_PROVIDER_CALL');
 };
}
function report(overrides={}){
 const form=new URLSearchParams({decision:'Choose a launch path <script>test</script>',project:'chief',evidence:'Unverified founder observation',nextGate:'Verify actual customer evidence',strategyPosition:'support',strategyConclusion:'Pilot first',strategyRecommendation:'Run a pilot',strategyRisk:'Demand uncertain',strategyConfidence:'90',researchPosition:'oppose',researchConclusion:'Evidence incomplete',researchRecommendation:'Validate demand',researchRisk:'Missing measurements',researchConfidence:'80',...overrides});
 return form.toString();
}
test('visual reconciliation retains crawler exclusion and shares exact local scenery',()=>{
 const app=readFileSync(new URL('../app.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../styles/chief-living-workspace.css',import.meta.url),'utf8');
 expect(app).toContain('<meta name="robots" content="noindex,nofollow" />');
 expect(app).toContain(accountScene);
 expect(app).toContain(accountPresence);
 expect(accountSceneCss).toBe(css);
});
test('signed-in workspace has living scenery, accessible pause and the real council form',async()=>{
 const r=await handleAccount(request('/workspace'),env,fixture([]));
 expect(r.status).toBe(200);
 const html=await r.text();
 for(const value of ['chief-living-scene','chief-scene-pause','chief-specialist-presence','/account/council','Live character connection pending'])expect(html).toContain(value);
 expect(r.headers.get('content-security-policy')).toContain("default-src 'none'");
 expect(r.headers.get('cache-control')).toContain('no-store');
});
test('council synthesis cannot run anonymously or from another origin',async()=>{
 const calls=[];
 expect((await handleAccount(request('/account/council',report(),false),env,fixture(calls))).status).toBe(303);
 expect((await handleAccount(request('/account/council',report(),true,'https://example.com'),env,fixture(calls))).status).toBe(403);
 expect(calls).toEqual([]);
});
test('council runs real local synthesis, preserves dissent and never calls a model',async()=>{
 const calls=[];
 const r=await handleAccount(request('/account/council',report()),env,fixture(calls));
 expect(r.status).toBe(200);
 const html=await r.text();
 expect(html).toContain('Confidence score: 49/100');
 expect(html).toContain('research (user-submitted): oppose');
 expect(html).toContain('unknown: Unverified founder observation');
 expect(html).toContain('Verify actual customer evidence');
 expect(html).toContain('&lt;script&gt;test&lt;/script&gt;');
 expect(html).not.toContain('<script>');
 expect(calls).toEqual(['/auth/v1/user']);
});
test('malformed report cannot claim elevated confidence or execute a plan',async()=>{
 const r=await handleAccount(request('/account/council',report({strategyConfidence:'101'})),env,fixture([]));
 expect(r.status).toBe(400);
 expect(await r.text()).not.toContain('Confidence score:');
});

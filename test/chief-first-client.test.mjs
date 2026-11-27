import { test, expect } from 'vitest';
import { handleAccount } from '../worker/account.mjs';
import { readFileSync } from 'node:fs';
import frontDoor from '../front-door/worker.mjs';

const origin='https://chief.foundercontrolroom.org';
const founder='00000000-0000-4000-8000-000000000001';
const member='00000000-0000-4000-8000-000000000002';
const env={CHIEF_ACCOUNTS_ENABLED:'true',CHIEF_AUTH_URL:'https://test-chief.supabase.co',CHIEF_AUTH_PUBLISHABLE_KEY:'sb_publishable_test_fixture',CHIEF_FOUNDER_SUBJECT:founder};
const cookie='__Host-chief_session=aaa.bbb.ccc';
const get=(path,signed=false)=>new Request(origin+path,{headers:signed?{cookie}:{}});
const post=(path,body,signed=false,source=origin)=>new Request(origin+path,{method:'POST',headers:{origin:source,'content-type':'application/x-www-form-urlencoded',...(signed?{cookie}:{})},body});
function fixture(userId=founder,records=[]){
 return async (url,init)=>{
  const p=new URL(url).pathname;
  if(p==='/auth/v1/user')return Response.json({id:userId,email_confirmed_at:'2026-11-27',is_anonymous:false});
  if(p==='/auth/v1/verify')return Response.json({access_token:'aaa.bbb.ccc',expires_in:3600});
  if(p==='/auth/v1/otp')return Response.json({});
  if(p==='/auth/v1/logout')return Response.json({});
  if(p==='/rest/v1/chief_business_records'){
   if(init.method==='POST'){
    for(const row of JSON.parse(init.body)){
     if(row.owner_id!==userId)throw Error('OWNER_SCOPE');
     if(!records.some(r=>r.owner_id===row.owner_id&&r.record_key===row.record_key))records.push(row);
    }
    return new Response(null,{status:201});
   }
   return Response.json(records);
  }
  throw Error('UNEXPECTED_FIXTURE_ROUTE');
 };
}
test('account activation is disabled by default',async()=>{
 const r=await handleAccount(get('/login'),{},()=>{throw Error('NO_PROVIDER_CALL');});
 expect(r.status).toBe(503);
 expect(r.headers.get('X-Robots-Tag')).toContain('noindex');
});
test('anonymous workspace cannot be opened',async()=>{
 const r=await handleAccount(get('/workspace'),env,fixture());
 expect(r.status).toBe(303);expect(r.headers.get('location')).toBe('/login');
});
test('cross-origin writes are rejected before provider access',async()=>{
 const r=await handleAccount(post('/account/request-code','email=a%40example.com&mode=login',false,'https://example.com'),env,fixture());
 expect(r.status).toBe(403);
});
test('public registration is disabled in founder pilot',async()=>{
 const r=await handleAccount(post('/account/request-code','email=a%40example.com&mode=signup'),env,fixture());
 expect(r.status).toBe(403);
});
test('verified founder receives a bounded secure session cookie',async()=>{
 const r=await handleAccount(post('/account/verify','email=a%40example.com&token=123456'),env,fixture());
 expect(r.status).toBe(303);
 const c=r.headers.get('set-cookie');
 for(const part of ['Secure','HttpOnly','SameSite=Lax','Max-Age=900','Path=/'])expect(c).toContain(part);
});
test('non-founder cannot enter a closed founder pilot even with valid identity',async()=>{
 expect((await handleAccount(get('/workspace',true),env,fixture(member))).status).toBe(403);
 expect((await handleAccount(post('/account/verify','email=a%40example.com&token=123456'),env,fixture(member))).status).toBe(403);
});
test('member role cannot initialize founder objectives after signup opens',async()=>{
 const r=await handleAccount(post('/account/start','',true),{...env,CHIEF_PUBLIC_SIGNUP_ENABLED:'true'},fixture(member));
 expect(r.status).toBe(403);
});
test('first-client initialization is idempotent and only proposes objectives',async()=>{
 const rows=[];const f=fixture(founder,rows);
 for(let i=0;i<2;i++)expect((await handleAccount(post('/account/start','',true),env,f)).status).toBe(303);
 expect(rows).toHaveLength(3);
 expect(rows.every(r=>r.owner_id===founder&&r.kind==='objective'&&r.classification==='proposed')).toBe(true);
});
test('workspace rejects cross-account records returned by provider',async()=>{
 const r=await handleAccount(get('/workspace',true),env,fixture(founder,[{owner_id:member,kind:'knowledge',classification:'user_reported',title:'Other',detail:'Private'}]));
 expect(r.status).toBe(503);expect(await r.text()).not.toContain('Other');
});
test('logout expires the local cookie',async()=>{
 const r=await handleAccount(post('/account/logout','',true),env,fixture());
 expect(r.headers.get('set-cookie')).toContain('Max-Age=0');
});
test('public product definition remains synchronized and distinguishes PromptOS',async()=>{
 const html=await (await frontDoor.fetch(new Request(origin+'/'))).text();
 expect(html).toBe(readFileSync(new URL('../public-face.html',import.meta.url),'utf8'));
 expect(html).toContain('How is Chief different from PromptOS?');
 expect(html).toContain('Founder Intelligence OS');
});
test('sitemap excludes private and fragment URLs',()=>{
 const s=readFileSync(new URL('../sitemap.xml',import.meta.url),'utf8');
 expect(s.match(/<loc>.*?<\/loc>/g)).toEqual(['<loc>'+origin+'/</loc>']);
 const robots=readFileSync(new URL('../robots.txt',import.meta.url),'utf8');
 expect(robots).toContain('Disallow: /account/');
 expect(robots).toContain('Disallow: /app');
 expect(robots.match(/User-agent:/g)).toHaveLength(1);
});

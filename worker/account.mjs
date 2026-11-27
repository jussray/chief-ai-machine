/* global URL, Response, fetch, URLSearchParams */
import { workspaceAction } from './workspace.mjs';
const ORIGIN='https://chief.foundercontrolroom.org';
const COOKIE='__Host-chief_session';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[\w-]+\.[\w-]+\.[\w-]+$/;
export const accountPaths=new Set(['/login','/signup','/workspace','/account/request-code','/account/verify','/account/logout','/account/me','/account/start','/account/record']);
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function page(title,body,status=200){
 return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+escape(title)+' | CHIEF</title><style>body{background:#090c17;color:#edf1ff;font:16px system-ui;max-width:48rem;margin:6vh auto;padding:1.5rem}main{border:1px solid #ffffff30;background:#ffffff0b;border-radius:18px;padding:1.5rem}a{color:#e9d5a0}input,button,select,textarea{font:inherit;padding:.8rem;margin:.5rem 0 1rem;width:100%;box-sizing:border-box;border-radius:8px}button{background:#e9d5a0;color:#090c17;border:0;cursor:pointer}input,select,textarea{background:#161b2a;color:white;border:1px solid #ffffff45}label{display:block}article{border-top:1px solid #ffffff25;padding:.6rem 0}small{color:#e9d5a0}textarea{min-height:6rem}p{line-height:1.6}</style></head><body><p><a href="/">CHIEF · Founder Intelligence OS</a></p><main><h1>'+escape(title)+'</h1>'+body+'</main></body></html>',{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
}
function redirect(to,cookie){return new Response(null,{status:303,headers:{...headers,Location:to,...(cookie?{'Set-Cookie':cookie}:{})}});}
function sessionCookie(value,maxAge){return COOKIE+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+maxAge;}
function config(env){
 const u=String(env?.CHIEF_AUTH_URL||'');const key=String(env?.CHIEF_AUTH_PUBLISHABLE_KEY||'');
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(u)||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))return null;
 return {url:u,key};
}
function readToken(request){const list=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));const t=list.length===1?list[0].slice(COOKIE.length+1):'';return t.length<4096&&TOKEN.test(t)?t:null;}
async function call(c,path,fetchImpl,data,token){
 /** @type {Record<string,string>} */
 const h={apikey:c.key,Accept:'application/json'};
 if(token)h.Authorization='Bearer '+token;
 if(data!==undefined)h['Content-Type']='application/json';
 return fetchImpl(c.url+path,{method:data===undefined?'GET':'POST',headers:h,...(data===undefined?{}:{body:JSON.stringify(data)}),redirect:'error'});
}
async function verifyIdentity(c,token,env,fetchImpl){
 if(!token)return null;
 const r=await call(c,'/auth/v1/user',fetchImpl,undefined,token);
 if(r.status===401||r.status===403)return null;
 if(!r.ok)throw Error('IDENTITY_PROVIDER_UNAVAILABLE');
 const u=await r.json();
 if(!UUID.test(u?.id||'')||!u.email_confirmed_at||u.is_anonymous!==false)return null;
 return {id:u.id,role:UUID.test(env.CHIEF_FOUNDER_SUBJECT||'')&&u.id===env.CHIEF_FOUNDER_SUBJECT?'founder':'member'};
}
export async function accountIdentity(request,env,fetchImpl=fetch){const c=config(env);return c?verifyIdentity(c,readToken(request),env,fetchImpl):null;}
function form(mode){return page(mode==='signup'?'Create your account':'Sign in','<p>Use your email to receive a one-time verification code.</p><form method="post" action="/account/request-code"><input type="hidden" name="mode" value="'+mode+'"><label>Email<input type="email" name="email" maxlength="254" autocomplete="email" required></label><button>Send code</button></form><p><a href="'+(mode==='signup'?'/login':'/signup')+'">'+(mode==='signup'?'Already have an account? Sign in':'New to CHIEF? Create an account')+'</a></p>');}
function codeForm(email){return page('Verification code','<p>If the address is eligible, a code will arrive by email. Enter the code to continue.</p><form method="post" action="/account/verify"><label>Email<input name="email" type="email" autocomplete="email" value="'+escape(email)+'" required></label><label>Code<input name="token" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" maxlength="8" required></label><button>Verify and sign in</button></form><a href="/login">Start again</a>');}
const validEmail=email=>typeof email==='string'&&email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export async function handleAccount(request,env,fetchImpl=fetch){
 const url=new URL(request.url);
 if(url.origin!==ORIGIN||!accountPaths.has(url.pathname))return page('Not found','',404);
 // Explicit activation is required after identity, delivery and tenant isolation proof.
 if(env?.CHIEF_ACCOUNTS_ENABLED!=='true')return page('Account service unavailable','<p>CHIEF account service is not activated.</p>',503);
 const c=config(env);
 if(!c)return page('Account service unavailable','<p>CHIEF account service has not been configured.</p>',503);
 const p=url.pathname;const isPost=p.startsWith('/account/')&&p!=='/account/me';
 if(request.method!==(isPost?'POST':'GET'))return page('Method not allowed','',405);
 if(isPost&&request.headers.get('origin')!==ORIGIN)return page('Request rejected','',403);
 try{
  if(p==='/login'||p==='/signup')return form(p.slice(1));
  if(p==='/account/request-code'||p==='/account/verify'){
   if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return page('Invalid request','',415);
   const text=await request.text();if(text.length>2048)return page('Invalid request','',413);
   const f=new URLSearchParams(text);const email=f.get('email')?.trim().toLowerCase();if(!validEmail(email))return page('Invalid email','<a href="/login">Try again</a>',400);
   if(p.endsWith('request-code')){
    const mode=f.get('mode');if(mode!=='login'&&mode!=='signup')return page('Invalid request','',400);
    // Enrollment remains founder-only/closed until the separate signup release is approved.
    if(mode==='signup'&&env.CHIEF_PUBLIC_SIGNUP_ENABLED!=='true')return page('Registration not open','<a href="/login">Sign in</a>',403);
    const r=await call(c,'/auth/v1/otp',fetchImpl,{email,create_user:mode==='signup'});
    if(r.status===429)return page('Please try again later','<a href="/login">Return to sign in</a>',429);
    if(r.status>=500||r.status===401||r.status===403)return page('Account service unavailable','',503);
    return codeForm(email);
   }
   const otp=f.get('token');if(!/^\d{6,8}$/.test(otp||''))return page('Invalid code','<a href="/login">Start again</a>',400);
   const r=await call(c,'/auth/v1/verify',fetchImpl,{email,token:otp,type:'email'});
   if(!r.ok)return page(r.status>=500?'Account service unavailable':'Code rejected','<a href="/login">Start again</a>',r.status>=500?503:400);
   const s=await r.json();
   if(typeof s.access_token!=='string'||s.access_token.length>=4096||!TOKEN.test(s.access_token)||!Number.isFinite(s.expires_in)||s.expires_in<1)return page('Account service unavailable','',503);
   const identity=await verifyIdentity(c,s.access_token,env,fetchImpl);
   if(!identity||(identity.role!=='founder'&&env.CHIEF_PUBLIC_SIGNUP_ENABLED!=='true'))return page('Account not admitted','',403);
   return redirect('/workspace',sessionCookie(s.access_token,Math.min(900,Math.floor(s.expires_in))));
  }
  if(p==='/account/logout'){
   const token=readToken(request);
   if(token){try{await call(c,'/auth/v1/logout?scope=local',fetchImpl,{},token);}catch{/* Local cookie expires even if provider revocation fails. */}}
   return redirect('/login',sessionCookie('',0));
  }
  const identity=await accountIdentity(request,env,fetchImpl);
  if(!identity)return p==='/account/me'?Response.json({error:'authentication_required'},{status:401,headers}):redirect('/login');
  if(identity.role!=='founder'&&env.CHIEF_PUBLIC_SIGNUP_ENABLED!=='true')return page('Account not admitted','',403);
  if(p==='/account/me')return Response.json({id:identity.id,role:identity.role},{headers});
  const result=await workspaceAction(p,request,c,readToken(request),identity,fetchImpl);
  if(result.redirect)return redirect(result.redirect);
  return page(result.title,result.body||'',result.status||200);
 }catch{return page('Account service unavailable','<a href="/login">Return to sign in</a>',503);}
}

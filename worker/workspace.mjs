/* global URL, crypto, URLSearchParams */
// First-party CHIEF business workspace. User JWT only; never use a service-role key.
const kinds = new Map([['objective','proposed'],['knowledge','user_reported'],['decision','proposed'],['measurement','user_reported']]);
const seed = [
  ['launch-readiness','objective','Make CHIEF ready for its first business client','Verify sign-in, private storage and real business workflows before claiming readiness.'],
  ['discovery','objective','Improve CHIEF search and answer-engine visibility','Publish accurate public product information and verify indexing separately from private workspace access.'],
  ['company-brain','objective','Establish Company Brain','Record business identity, constraints, decisions and evidence. Mark founder inputs as user reported until independently verified.']
];
const escape = x => String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function data(c,token,identity,fetchImpl,rows){
  const url=new URL('/rest/v1/chief_business_records',c.url);
  const headers={apikey:c.key,Authorization:'Bearer '+token,Accept:'application/json'};
  if(rows){url.searchParams.set('on_conflict','owner_id,record_key');headers.Prefer='resolution=ignore-duplicates,return=minimal';headers['Content-Type']='application/json';}
  else {url.searchParams.set('owner_id','eq.'+identity.id);url.searchParams.set('select','owner_id,record_key,kind,title,detail,classification');url.searchParams.set('order','created_at.desc');url.searchParams.set('limit','100');}
  const res=await fetchImpl(url.toString(),{method:rows?'POST':'GET',headers,redirect:'error',...(rows?{body:JSON.stringify(rows)}:{})});
  if(!res.ok)throw Error('WORKSPACE_STORAGE_UNAVAILABLE');
  if(rows)return;
  const records=await res.json();
  if(!Array.isArray(records)||records.some(r=>!r||r.owner_id!==identity.id||!kinds.has(r.kind)||r.classification!==kinds.get(r.kind)||typeof r.title!=='string'||typeof r.detail!=='string'))throw Error('WORKSPACE_BOUNDARY_INVALID');
  return records;
}
function record(identity,key,kind,title,detail){return {owner_id:identity.id,record_key:key,kind,title,detail,classification:kinds.get(kind)};}
export async function workspaceAction(path,request,c,token,identity,fetchImpl){
  if(path==='/account/start'){
    if(identity.role!=='founder')return {status:403,title:'Founder access required'};
    await data(c,token,identity,fetchImpl,seed.map(([key,kind,title,detail])=>record(identity,'first-client-'+key,kind,title,detail)));
    return {redirect:'/workspace'};
  }
  if(path==='/account/record'){
    if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return {status:415,title:'Invalid request'};
    const raw=await request.text();if(raw.length>12000)return {status:413,title:'Record too large'};
    const form=new URLSearchParams(raw),kind=form.get('kind'),title=form.get('title')?.trim(),detail=form.get('detail')?.trim();
    if(!kinds.has(kind)||!title||title.length>200||!detail||detail.length>2000)return {status:400,title:'Invalid record'};
    await data(c,token,identity,fetchImpl,[record(identity,crypto.randomUUID(),kind,title,detail)]);
    return {redirect:'/workspace'};
  }
  const rows=await data(c,token,identity,fetchImpl);
  const labels={objective:'Objectives',knowledge:'Company Brain',decision:'Decision intelligence',measurement:'Business measurements'};
  const cards=Array.from(kinds.keys(),kind=>'<section><h2>'+labels[kind]+'</h2>'+(rows.filter(r=>r.kind===kind).map(r=>'<article><h3>'+escape(r.title)+'</h3><p>'+escape(r.detail)+'</p><small>'+escape(r.classification.replace('_',' '))+' · not independently verified</small></article>').join('')||'<p>No entries in this section.</p>')+'</section>').join('');
  return {title:identity.role==='founder'?'Founder workspace':'Business workspace',body:'<p>Signed in. Your identity has been verified.</p>'+(identity.role==='founder'?'<p><strong>First client · Founder</strong></p><form method="post" action="/account/start"><button>Initialize first-client objectives</button></form>':'')+'<p>Your business records belong to this account. Account role does not grant execution authority.</p>'+cards+'<section><h2>Add business intelligence</h2><form method="post" action="/account/record"><label>Record type<select name="kind"><option value="objective">Objective</option><option value="knowledge">Company knowledge</option><option value="decision">Decision proposal</option><option value="measurement">Reported measurement</option></select></label><label>Title<input name="title" maxlength="200" required></label><label>Details<textarea name="detail" maxlength="2000" required></textarea></label><button>Save private record</button></form></section><p>CHIEF does not infer achieved results from unsupported entries.</p><form method="post" action="/account/logout"><button>Sign out</button></form>'};
}

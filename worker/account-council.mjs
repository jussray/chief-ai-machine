/* global URLSearchParams */
// Authenticated, proposal-only synthesis. User input is never promoted to verified evidence.
import { createSpecialistReport } from '../src/domain/specialist-report.js';
import { synthesizeExecutiveCouncil } from '../src/domain/executive-council.js';

export const councilForm = "<section id=\"chief-council\"><h2>Executive Council · draft synthesis</h2><p>Enter two specialist perspectives you have obtained or authored. These are user-submitted reports, not live agent responses. CHIEF combines them locally, preserves dissent, and identifies the next review gate. No external model is called.</p><form method=\"post\" action=\"/account/council\"><label>Decision to evaluate<input name=\"decision\" maxlength=\"400\" required></label><label>Project<input name=\"project\" maxlength=\"100\" required></label><label>Supporting evidence (not independently verified)<textarea name=\"evidence\" maxlength=\"1000\" required></textarea></label><label>Next review gate<input name=\"nextGate\" maxlength=\"400\" required></label><fieldset><legend>Strategy perspective</legend><label>Position<select name=\"strategyPosition\"><option value=\"support\">Support</option><option value=\"conditional\">Conditional</option><option value=\"oppose\">Oppose</option><option value=\"abstain\">Abstain</option></select></label><label>Conclusion<textarea name=\"strategyConclusion\" maxlength=\"600\" required></textarea></label><label>Recommendation<textarea name=\"strategyRecommendation\" maxlength=\"600\" required></textarea></label><label>Risk or dependency<input name=\"strategyRisk\" maxlength=\"400\" required></label><label>Self-reported confidence (0–100)<input name=\"strategyConfidence\" type=\"number\" min=\"0\" max=\"100\" step=\"1\" required></label></fieldset><fieldset><legend>Research perspective</legend><label>Position<select name=\"researchPosition\"><option value=\"support\">Support</option><option value=\"conditional\">Conditional</option><option value=\"oppose\">Oppose</option><option value=\"abstain\">Abstain</option></select></label><label>Conclusion<textarea name=\"researchConclusion\" maxlength=\"600\" required></textarea></label><label>Recommendation<textarea name=\"researchRecommendation\" maxlength=\"600\" required></textarea></label><label>Risk or dependency<input name=\"researchRisk\" maxlength=\"400\" required></label><label>Self-reported confidence (0–100)<input name=\"researchConfidence\" type=\"number\" min=\"0\" max=\"100\" step=\"1\" required></label></fieldset><button>Prepare executive brief</button></form></section>";
const escape = x => String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const domains = ['strategy','research'];
const positions = new Set(['support','conditional','oppose','abstain']);
const invalid = () => ({status:400,title:'Invalid council input',body:'<p>Complete each bounded report and next review gate.</p><a href="/workspace">Return to workspace</a>'});

export async function synthesizeAccountCouncil(request, identity) {
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return {status:415,title:'Invalid request'};
  const raw = await request.text();
  if(raw.length>12000) return {status:413,title:'Report too large'};
  const form = new URLSearchParams(raw);
  const read = (name,max) => {
    const all=form.getAll(name);
    const value=all.length===1?all[0].trim():'';
    if(!value||value.length>max) throw Error('INVALID_COUNCIL_FIELD');
    return value;
  };
  let synthesis;
  try {
    const decision=read('decision',400),project=read('project',100),evidence=read('evidence',1000),nextGate=read('nextGate',400);
    const reports=domains.map(domain=>{
      const position=read(domain+'Position',20);
      const confidenceText=read(domain+'Confidence',3);
      if(!positions.has(position)||!/^\d{1,3}$/.test(confidenceText)||Number(confidenceText)>100)throw Error('INVALID_COUNCIL_REPORT');
      const risk=read(domain+'Risk',400);
      return createSpecialistReport({
        workspaceId:identity.id,projectId:project,role:domain+' (user-submitted)',domain,position,
        conclusion:read(domain+'Conclusion',600),recommendation:read(domain+'Recommendation',600),
        reality:[{state:'unknown',statement:evidence,sourceRefs:[]}],
        confidence:Number(confidenceText),risks:[risk,'Evidence is user-submitted and not independently verified.'],
        dependencies:position==='conditional'?[risk]:[],status:'draft',source:'account-user-submitted'
      });
    });
    synthesis=synthesizeExecutiveCouncil({workspaceId:identity.id,projectId:project,decision,reports,nextGate,status:'draft'});
  } catch {return invalid();}
  const brief=synthesis.brief;
  const dissent=brief.dissent.map(item=>'<li>'+escape(item.role)+': '+escape(item.position)+' — '+escape(item.reason)+'</li>').join('');
  const risks=brief.risks.map(risk=>'<li>'+escape(risk)+'</li>').join('');
  const reality=brief.reality.map(item=>'<li>'+escape(item.state)+': '+escape(item.statement)+'</li>').join('');
  const body='<section id="chief-council-brief"><h2>'+escape(brief.decision)+'</h2><p>Draft only · user-submitted evidence · no provider execution</p><p>Confidence score: '+escape(brief.confidence)+'/100 (rule-based; not a probability)</p><h3>Reasoning synthesis</h3><p>'+escape(brief.rationale)+'</p><h3>Evidence</h3><ul>'+reality+'</ul><h3>Dissent and conditions</h3>'+(dissent?'<ul>'+dissent+'</ul>':'<p>No dissent submitted.</p>')+'<h3>Risks</h3><ul>'+risks+'</ul><h3>Next gate</h3><p>'+escape(brief.nextGate)+'</p><p>Founder Control Room retains execution authority. This response is not stored or sent to an external model.</p><a href="/workspace">Return to workspace</a></section>';
  return {title:'Executive brief',body};
}

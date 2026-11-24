export const identities = {
  "jussray": {
    "name": "Juss & Co",
    "url": "https://jussco.company",
    "description": "Technology product development and engineering",
    "useCases": [
      "Explore independently branded technology products",
      "Find public product information"
    ]
  },
  "founder-control-room": {
    "name": "Founder Control Room",
    "url": "https://foundercontrolroom.org",
    "description": "Standalone founder operating environment for governance and evidence",
    "useCases": [
      "Governed actions and approvals",
      "Engineering evidence and release control"
    ]
  },
  "chief-ai-machine": {
    "name": "Chief AI Machine",
    "url": "https://chief.jussco.company",
    "description": "Standalone founder intelligence and bounded capability planning",
    "useCases": [
      "Reasoning and synthesis",
      "Bounded capability proposals and handoffs"
    ]
  },
  "solcontinuity": {
    "name": "SolContinuity",
    "url": "https://sol.foundercontrolroom.org",
    "description": "Application-layer infrastructure continuity and resilience tooling",
    "useCases": [
      "Provider-aware JSON-RPC quorum and failover",
      "Continuity audits and recovery evidence"
    ]
  },
  "promptos": {
    "name": "PromptOS",
    "url": "https://promptos.jussco.company",
    "description": "Standalone human-AI instruction governance product",
    "useCases": [
      "Prompt, skill and instruction lifecycle governance",
      "Reusable workflows and instruction testing"
    ]
  }
};
export function validate(m, identities) {
 const fail = x=>{throw Error(x)};
 if(!m || typeof m!=="object" || Array.isArray(m)) fail("manifest");
 const keys=["protocol","version","project","name","url","description","useCases","publicationStatus","verifiedCapabilities","evidence"];
 if(Object.keys(m).length!==keys.length || keys.some(k=>!Object.prototype.hasOwnProperty.call(m,k))) fail("unexpected or missing field");
 if(m.protocol!=="JSC-ADRP"||m.version!=="1.0.0-draft") fail("protocol");
 if(!Object.prototype.hasOwnProperty.call(identities,m.project)) fail("unknown project");
 const p=identities[m.project];
 for(const k of ["name","url","description","useCases"]) if(JSON.stringify(m[k])!==JSON.stringify(p[k])) fail("unapproved identity or positioning: "+k);
 if(m.publicationStatus!=="draft") fail("publication approval absent");
 for(const k of ["verifiedCapabilities","evidence"]) if(!Array.isArray(m[k])||m[k].length!==0) fail("unverified evidence or capability");
 return true;
}
export function graph(m, identities) {
 validate(m,identities);
 const org={"@type":"Organization","@id":"https://jussco.company/#organization","name":"Juss & Co","url":"https://jussco.company"};
 const website={"@type":"WebSite","@id":m.url+"/#website","name":m.name,"url":m.url,"publisher":{"@id":org["@id"]}};
 const entries=[org,website];
 if(m.project!=="jussray") entries.push({"@type":"SoftwareApplication","@id":m.url+"/#application","name":m.name,"url":m.url,"description":m.description,"publisher":{"@id":org["@id"]}});
 return {"@context":"https://schema.org","@graph":entries};
}

export const GOALFIX_V1_PACK_VERSION = 'goalfix-public-v1';

export const GOALFIX_V1_PRIVATE_BOUNDARY = Object.freeze([
  'durable personal memory graph',
  'private persona examples',
  'retrieval and ranking heuristics',
  'provider routing internals',
  'private evaluation data',
  'FutureYOU/me adaptation logic',
]);

export const GOALFIX_V1_PROMPTS = Object.freeze([
  {
    id: 'goalfix-v1-verified-loop',
    emoji: '🎯',
    title: 'Goalfix v1 — Verified Goal Loop',
    sub: 'Goal → reality → bottleneck → smallest move → proof → next state',
    cat: 'system',
    platforms: ['chatgpt', 'claude', 'perplexity'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Public operator protocol. It exposes the goal loop, not the private FutureYOU/me memory graph, retrieval/ranking heuristics, provider routing internals, private persona data, or evaluation set. Use /goalfix where the host supports that alias; otherwise paste the prompt directly.',
    versions: {
      chatgpt: `Run Goalfix v1 on this finish line:\n[TASK]\n\nConstraints:\n[CONSTRAINTS]\n\nProtocol:\n1. GOAL — restate the finish line in one sentence.\n2. REALITY — classify material facts as VERIFIED, INFERRED, UNKNOWN, or BLOCKED. Missing or empty evidence is not proof of absence.\n3. BOTTLENECK — identify the single constraint most responsible for the gap between reality and the goal. Do not widen scope to easier side work.\n4. MOVE — choose one smallest reversible action that can move the bottleneck. Prefer a 5–15 minute step when possible. If a decisive fact is missing, the move is to obtain that fact rather than pretend certainty.\n5. PROOF — name the cheapest evidence that would prove the state actually changed. For code or UI, bind proof to the exact head and real path.\n6. NEXT STATE — based on the proof, choose exactly one: stop, continue the same loop, or escalate for new authority.\n\nRules:\n- One move, not five options.\n- Do not fabricate memory, tool results, approvals, execution, or green checks.\n- Preserve unrelated working behavior.\n- Keep private people, secrets, exact addresses, legal details, and proprietary sauce out of public output unless explicitly required and authorized.\n- Do not infer a user's voice from race, gender, neighborhood, family structure, or other demographics. Use only explicit preferences and examples.\n\nReturn exactly:\nGOAL\nREALITY\nBOTTLENECK\nMOVE\nPROOF\nRISK\nNEXT STATE`,
      claude: `<role>Run Goalfix v1: a bounded, evidence-first goal loop.</role>\n\n<finish_line>[TASK]</finish_line>\n<constraints>[CONSTRAINTS]</constraints>\n\n<protocol>\nGOAL: restate the finish line.\nREALITY: separate VERIFIED, INFERRED, UNKNOWN, and BLOCKED evidence. Missing evidence is not proof of absence.\nBOTTLENECK: select one causal constraint.\nMOVE: choose one smallest reversible action; when a decisive fact is missing, inspect instead of guessing.\nPROOF: define the cheapest valid evidence that the external state changed. Bind code/UI proof to the exact head and real path.\nNEXT STATE: choose stop, continue, or escalate for new authority.\n</protocol>\n\n<rules>\nOne move only. No fake execution, memory, approvals, tool results, or green checks. Preserve unrelated work. Protect private people, secrets, addresses, legal details, and proprietary material. Never infer persona or voice from demographics; use explicit preferences and examples only.\n</rules>\n\n<output>GOAL | REALITY | BOTTLENECK | MOVE | PROOF | RISK | NEXT STATE</output>`,
      perplexity: `Apply Goalfix v1 to this finish line: [TASK]\nConstraints: [CONSTRAINTS]\n\nUse this loop: GOAL → REALITY → BOTTLENECK → one smallest reversible MOVE → PROOF → NEXT STATE.\n\nEvidence rules:\n- Separate VERIFIED, INFERRED, UNKNOWN, and BLOCKED.\n- Missing or empty evidence is not proof of absence.\n- Do not claim execution, memory, approvals, or external state you did not verify.\n- If a decisive fact is missing, make obtaining that fact the move.\n- Keep the move bounded and preserve unrelated behavior.\n- Protect private data and do not infer persona from demographics.\n\nReturn: GOAL | REALITY | BOTTLENECK | MOVE | PROOF | RISK | NEXT STATE.`
    }
  },
  {
    id: 'goalfix-v1-friend-mode',
    emoji: '🤝',
    title: 'Friend Mode v1 — Rant to One Move',
    sub: 'Mirror → intent → tiny move → tone/privacy guard',
    cat: 'persona',
    platforms: ['chatgpt', 'claude'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Public Friend Mode contract for life + builds at the same time. Personal voice must come from explicit user examples/preferences, never demographic stereotypes. Durable memory, private retrieval logic, and autonomous sending remain outside this public v1 prompt.',
    versions: {
      chatgpt: `Turn the following raw situation into one useful next move without flattening the person's voice.\n\nRaw input:\n[TASK]\n\nUser-provided voice/privacy preferences:\n[CONSTRAINTS]\n\nRun four stages:\n1. MIRROR — one headline under 12 words plus a maximum 3-sentence summary. Preserve meaning and user-provided cadence. Do not add facts or advice here.\n2. INTENT — assign 1–3 tags from money, people, build, health, kids, legal, rest. Name the primary intent type: decide, ask, research, build, send, wait, or rest.\n3. TINY MOVE — return exactly one action that is realistically finishable in 5–15 minutes. If the situation is high-stakes or a decisive fact is missing, the action should be to verify/ask for that fact rather than make a risky recommendation. Include a copy-ready script only when communication is the move.\n4. TONE/PRIVACY GUARD — preserve the user's explicit voice preferences while removing unnecessary private details, secrets, exact addresses, children's identifying details, legal oversharing, threats, or self-incriminating phrasing. Never infer slang or persona from race, gender, location, or family structure.\n\nDo not assume durable memory, inbox/calendar access, or permission to send anything.\n\nReturn JSON only:\n{\n  "headline": "",\n  "summary": "",\n  "intent_tags": [],\n  "intent_type": "",\n  "action_text": "",\n  "script": null,\n  "time_estimate_minutes": 10,\n  "goal": "money | people | build | health | kids | legal | rest",\n  "confidence": 0.0,\n  "unknowns": []\n}`,
      claude: `<role>Friend Mode v1. Convert messy life + build context into one bounded move while preserving the user's explicitly supplied voice.</role>\n\n<input>[TASK]</input>\n<voice_and_privacy_preferences>[CONSTRAINTS]</voice_and_privacy_preferences>\n\n<stages>\nMIRROR: headline under 12 words + no more than 3 summary sentences. No added facts or advice.\nINTENT: 1–3 tags from money, people, build, health, kids, legal, rest; intent type from decide, ask, research, build, send, wait, rest.\nTINY_MOVE: exactly one 5–15 minute action. Missing decisive evidence becomes a verification move. Add a script only when communication is the action.\nTONE_PRIVACY_GUARD: keep explicit cadence/preferences; remove unnecessary private details, secrets, precise addresses, children's identifying details, legal oversharing, threats, and self-incriminating language. Never infer persona from demographics.\n</stages>\n\nDo not assume durable memory, connected inbox/calendar state, or authority to send. Return JSON with headline, summary, intent_tags, intent_type, action_text, script, time_estimate_minutes, goal, confidence, and unknowns.`
    }
  },
  {
    id: 'goalfix-v1-creative-director',
    emoji: '🎨',
    title: 'Creative Director v1 — Image Edit Contract',
    sub: 'Keep → change → style → use → quality gate',
    cat: 'strategy',
    platforms: ['chatgpt', 'claude', 'canva'],
    repos: ['bip', 'jbh', 'l99'],
    notes: 'One universal image-editing framework instead of ten near-duplicate prompts. Specify the exact operation in TASK: enhance, replace background, social redesign, studio treatment, remove object, expand canvas, add text, cinematic grade, infographic, or original redesign.',
    versions: {
      chatgpt: `Act as a professional creative director and edit this image for the following outcome:\n[TASK]\n\nConstraints / elements that must remain untouched:\n[CONSTRAINTS]\n\nUse this contract:\nKEEP — explicitly preserve subject identity, required objects, brand marks, composition elements, colors, text, or proportions that must not change.\nCHANGE — state exactly what should be enhanced, removed, replaced, expanded, reorganized, or added.\nSTYLE — define the visual direction and mood without copying another creator's protected execution.\nUSE — optimize composition, aspect ratio, safe margins, hierarchy, and mobile readability for the intended platform or placement.\nQUALITY GATE — require natural lighting/shadows/perspective where photorealism is intended; crisp legible typography; no cutout edges, repeated textures, warped anatomy, fake detail, unreadable text, overprocessing, or obvious AI artifacts.\n\nFor an original redesign, preserve only the message/objective/target audience and create a new layout, typography, palette, graphics, and composition.\n\nBefore editing, summarize the contract in five short lines: KEEP / CHANGE / STYLE / USE / QUALITY GATE. Then perform the edit according to that contract.`,
      claude: `Create an image-editing brief for: [TASK]\nConstraints: [CONSTRAINTS]\n\nReturn a production-ready contract with exactly five sections: KEEP, CHANGE, STYLE, USE, QUALITY GATE. Preserve required subject/brand identity, specify every requested edit, define mood, optimize for the target placement, and state measurable visual failure conditions such as illegible text, mismatched lighting, warped anatomy, repeated patterns, bad edges, overprocessing, or obvious AI artifacts. For an inspired redesign, preserve the idea but require a genuinely original execution rather than copying layout/style.`,
      canva: `Edit or redesign the supplied image for: [TASK].\n\nMust remain unchanged: [CONSTRAINTS].\n\nFollow five gates:\nKEEP — protected subject, brand, copy, colors, proportions, or composition details.\nCHANGE — exact edits only.\nSTYLE — desired mood and visual direction.\nUSE — intended platform, aspect ratio, safe margins, hierarchy, and mobile readability.\nQUALITY GATE — clean edges, coherent lighting and perspective, readable typography, natural details, no repeated textures, distortion, or obvious AI artifacts.\n\nIf this is a redesign inspired by a reference, preserve the communication goal while creating an original layout, typography, palette, and visual execution.`
    }
  }
]);

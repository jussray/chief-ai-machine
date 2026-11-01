

# Intent Repair Reader

## When to Use This Skill

Use when:
- User input contains typos, misspellings, or non-standard grammar
- A request seems ambiguous or could mean multiple things
- User uses shorthand, slang, or domain jargon that might be mistyped
- The literal meaning of a request doesn't make sense in context
- You need to decide: answer what they typed, or answer what they meant?

## Core Philosophy

People communicate intent, not perfect syntax. The reader's job is to reconstruct intent from imperfect signal. This is what humans do naturally using:

1. **Context clues** — surrounding words and sentences narrow meaning
2. **Phonetic similarity** — what they typed sounds like what they meant
3. **Keyboard proximity** — mistyped keys are often neighbors on the keyboard
4. **Domain knowledge** — in a coding context, certain words have specific meanings
5. **Pattern recognition** — common swaps, autocorrect failures, and fat-finger patterns

## Intent Parsing Protocol

### Step 1: Read the Full Input First

Before interpreting any single word, read the entire message. Context determines meaning.

Example: "I want to make a sight for my app"
- Literal: a visual site (sight) for the app
- Context: they're building software → they mean "site" (website)
- Answer based on intent, not literal typo

### Step 2: Check for Typos Using Multiple Signals

#### Keyboard Neighbor Analysis
Common QWERTY mistypes:
- `a` ↔ `s`, `s` ↔ `d`, `d` ↔ `f` (home row drift)
- `e` ↔ `r`, `r` ↔ `t` (top row drift)
- `n` ↔ `m`, `b` ↔ `n` (bottom row)
- `u` ↔ `i`, `i` ↔ `o`, `o` ↔ `p`

Example: "I want to bild an app" → "bild" → keyboard analysis: `l` and `i` are neighbors, `d` is correct → "build"

#### Phonetic Analysis
Sound-alike words that get swapped:
- their/there/they're
- sight/site/cite
- write/right/rite
- too/to/two
- affect/effect
- principle/principal
- complement/compliment

When a word doesn't fit, ask: "What sounds like this word but makes sense here?"

#### Autocorrect Failures
Phone autocorrect commonly turns:
- Technical terms into common words ("React" → "Reach", "Expo" → "Expand")
- Abbreviations into full words ("API" → "App", "npm" → "BPM")
- Code identifiers into English words

### Step 3: Use Context Clues (Reading Comprehension Fundamentals)

Apply the same strategies taught in elementary reading:

1. **Surrounding sentence context** — What is the overall topic? Which interpretation fits?
2. **Prior message context** — What were we just discussing? Continuity suggests meaning.
3. **Project context** — What project is this for? Domain-specific terms are likely.
4. **Structural clues** — If they listed 3 items and one doesn't fit, it's probably a typo.
5. **Logical consistency** — If a literal reading creates an impossible or absurd request, they meant something else.

### Step 4: Confidence Threshold

After parsing intent, assess confidence:

- **HIGH (90%+)**: Only one reasonable interpretation. Answer it directly. Don't mention the typo.
- **MEDIUM (60-89%)**: One interpretation is most likely but another is possible. Answer the most likely. Briefly note: "I assumed you meant X — if you meant Y, let me know."
- **LOW (below 60%)**: Multiple interpretations are equally likely. Answer the most likely one but explicitly ask for clarification on the ambiguity.

### Step 5: Never Do These

- **Never correct spelling publicly.** If "bild" means "build," just answer about building. Don't say "I think you mean 'build'."
- **Never refuse to answer because of typos.** Always attempt best-effort interpretation.
- **Never be condescending.** The user is communicating, not taking a spelling test.
- **Never ask for clarification when the intent is clear.** If you're 90%+ sure, just answer.
- **Never silently change the meaning.** If you're guessing, say so briefly.

## Common Patterns by Domain

### Software Development
- "sight" → "site" (website)
- "app" could mean: application, app store, app.js, the app directory
- "componet" → "component"
- "stat" → "state" or "stat" (statistics) — context determines
- "hooks" → React hooks, or webhook — context determines
- "deps" → dependencies, or depth — context determines

### Project Management
- "sprint" could mean: agile sprint, or a quick burst of work
- "ticket" could mean: issue tracker ticket, or support ticket
- "deploy" could mean: production deploy, staging deploy, or local build

### General
- Run-on sentences: break them into parts, interpret each part
- Missing words: infer from context what's missing
- Wrong verb tense: interpret as the intended tense
- Phone typing compression: "u" = "you", "ur" = "your", "rn" = "right now"

## Integration

- Use before **lean-build-orchestrator** to ensure the build request is correctly understood
- Use with **truth-research-optimizer** to refine ambiguous research queries
- Use with **capability-mode-router** `/human` mode for natural, non-pedantic responses
## Available connectors

Use `muse.connector_search` to find the current connector docs before following
recovered instructions.



# Minimal Token Operating Protocol (MTOP)

> A protocol for getting maximum work from AI tools on free tiers. Applies to Claude, ChatGPT, and Perplexity Computer.

## Core Principle

Every token has a cost. On free tiers, you have limited messages per session. The goal is to extract maximum working output per token spent.

## Rules

### 1. Code First, Prose Never

**Bad (wastes tokens):**
> "Let me explain my approach to solving this. First, I'll create a function that handles the user input. This function will take a string parameter and return a boolean. The reason I'm using this approach is because..."

**Good (saves tokens):**
```javascript
function isValidInput(input) {
  return typeof input === 'string' && input.trim().length > 0;
}
```

### 2. No Preamble, No Postamble

Don't start with "Here's the solution" or "To fix this issue." Just give the solution.
Don't end with "Let me know if you need any changes" or "Hope this helps." Just end.

### 3. File-First Architecture

Write long content to files. Reference the path. Don't paste file contents into chat.

**Bad:** Pasting a 200-line file into the chat (costs ~400 tokens in, ~400 out for discussion)
**Good:** "Read src/auth.js. The issue is on line 34: token expiry not checked." (costs ~30 tokens)

### 4. One Ask Per Message

Don't ask 5 questions in one message. Each question generates a long response. Instead:
- Ask the most important question
- Let the answer guide the next question
- This avoids getting 5 things when you needed 1

### 5. Batch Independent Operations

If you need 3 independent things done, ask for all 3 in one message with clear numbered points. The AI can do them in parallel rather than 3 round trips.

### 6. Use Commands to Set Mode Once

Instead of explaining how you want the response formatted every time:
- Set it once in custom instructions (ChatGPT) or project instructions (Claude)
- Use command shortcuts: `/lindy /artifact` instead of "please use proven technology and give me working code"
- This saves ~50-100 tokens per message

### 7. Reference, Don't Repeat

If you discussed something 3 messages ago, reference it:
- "Following up on the auth issue from earlier..."
- Don't re-explain the context. The AI has it in context.

### 8. Kill the Bullets

Bullet lists and tables are token-expensive. Use them only for:
- Comparisons (where structure helps)
- Checklists (where order matters)
- Specs (where completeness matters)

For everything else, use prose. One sentence is cheaper than five bullets.

### 9. Session Management

- Keep sessions focused on one project/task
- Start new sessions for unrelated work (avoids context bloat)
- Write important findings to files before ending a session
- Git commit before switching tools

### 10. Know When to Switch Tools

| Task | Best Tool | Why |
|------|-----------|-----|
| Research APIs, verify facts | Perplexity | Web search built-in |
| Read entire codebase, generate code | Claude | Longest context |
| Run/test Python code quickly | ChatGPT | Code Interpreter |
| Browse a website, fill forms | Perplexity | Browser automation |
| Quick prototype iteration | ChatGPT | Fast back-and-forth |
| Multi-file refactoring | Claude | Large context + Artifacts |
| Ship working code to GitHub | Any | Git commands work everywhere |

## Token Budget Tracking

Rough token costs per output type:

| Output Type | Approximate Tokens |
|------------|-------------------|
| Single function (10-20 lines) | 100-200 |
| Single file (50-100 lines) | 400-800 |
| Bug fix (diff + explanation) | 100-300 |
| Architecture overview | 300-600 |
| Full feature (multiple files) | 800-2000 |

**Rule of thumb:** If your response would be over 1500 tokens, ask: "Can this be a file write + 3 lines of summary?"

## Free-Tier Session Strategy

### Claude Free Tier
- Limited messages per session (~30-40 on free)
- Use for: code generation, code review, architecture
- Save context: use Projects, commit to GitHub
- Switch to another tool when you hit limits

### ChatGPT Free Tier
- Limited GPT-4 messages (~40 per 3 hours on free)
- Use Code Interpreter first — it verifies code
- Fall back to GPT-3.5 for simple tasks (unlimited)
- Use Custom GPTs to store instructions

### Perplexity Free Tier
- Limited Pro searches per day
- Use for: research, verification, web-based tasks
- File system persists — use it for state
- Browser automation for testing

### Cross-Tool Relay Pattern
```
1. Perplexity: Research the API/library (verified facts)
   → Save findings to a file in the repo
2. Claude: Generate the code based on findings
   → Commit to GitHub
3. ChatGPT: Test the code in Code Interpreter
   → Fix issues, commit fixes
4. Perplexity: Verify the final output works in browser
5. Any: Ship
```

## Anti-Patterns (Token Wasters)

- Re-explaining what the user already knows
- Adding "helpful" context the user didn't ask for
- Suggesting improvements unrelated to the current task
- Writing documentation no one asked for
- Using 3 paragraphs where 3 words work
- Apologizing for things
- Asking "Does that make sense?" or "Would you like me to continue?"
- Listing caveats and limitations for every trivial suggestion
## Available connectors

Use `muse.connector_search` to find the current connector docs before following
recovered instructions.

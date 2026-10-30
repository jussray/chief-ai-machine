

# Humanize

Take text that sounds like an AI wrote it and make it sound like a specific person did. The job is register and rhythm, not new content.

## First: get the target voice
"Make it sound human" is underspecified — human like *who*? Before rewriting, anchor to one of these:
- **Samples (best):** 3-5 real pieces of the person's actual writing. Infer their sentence length, rhythm, vocabulary, and what they never say.
- **Rules:** explicit constraints — max sentence length, forbidden words, tone, formality.

If neither is available and the target isn't already obvious from context, ask for one. Guessing a voice is how you produce generic text with a different coat of paint.

## Strip the tells
These are the patterns that read as machine-generated. Cut them:

- **Vocabulary:** delve, tapestry, testament, realm, navigate (as metaphor), leverage (as verb), robust, seamless, elevate, unlock, harness, foster, underscore, foundational, pivotal, crucial, vital, myriad, plethora, "in today's fast-paced world."
- **Structure:** "It's not just X, it's Y." "This isn't about X — it's about Y." The grand pronouncement — "This isn't a budget. It's a statement of intent." Rule-of-three on everything. "Whether you're a X or a Y." Sweeping openers like "Most people…" that generalize instead of saying something specific.
- **Padding:** "It's worth noting that," "It's important to remember," "That said," "Here's the thing," "After careful consideration," "I wanted to give a quick update" openers; "Ultimately," "At the end of the day," "I hope this helps," "Let me know if..." closers.
- **Punctuation:** the em-dash used as a dramatic beat where a period works; semicolons stacked for false sophistication.
- **Rhythm:** every sentence the same medium length. Real writing varies — short punches next to longer runs, the occasional fragment.

## Then
1. Vary sentence length deliberately. Let some land in three words.
2. Cut adjectives and adverbs that aren't doing work — especially filler adverbs like "quietly," "simply," "actually," "basically" ("the system quietly handles X").
3. Read it aloud in your head: would this person actually say this sentence out loud? If not, rewrite it.

## Output
Return the rewritten text, nothing wrapped around it. If you worked from samples, you can note in one line what register you matched — but only if it helps, and never as a preamble to the text itself.
## Available connectors

Use `muse.connector_search` to find the current connector docs before following
recovered instructions.

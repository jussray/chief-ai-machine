import { createPerplexityRouter } from '../worker/perplexity-router.js';

if (!process.env.PERPLEXITY_API_KEY) {
  console.error('PERPLEXITY_API_KEY is missing. Create a key in the Perplexity API Console and export it in your own terminal.');
  process.exitCode = 2;
} else {
  const router = createPerplexityRouter();
  const models = await router.listModels();
  const model = models
    .filter((entry) => Number.isFinite(entry?.pricing?.input) && Number.isFinite(entry?.pricing?.output))
    .sort((a, b) => (a.pricing.input + a.pricing.output) - (b.pricing.input + b.pricing.output))[0]?.id
    ?? models[0]?.id;

  if (!model) {
    throw new Error('Perplexity Router returned an empty model allowlist.');
  }

  const completion = await router.chat.completions.create({
    model,
    max_tokens: 8,
    messages: [
      { role: 'user', content: 'Reply with OK.' },
    ],
  });

  console.log(JSON.stringify({
    object: completion.object,
    choices: completion.choices.length,
    hasUsage: Boolean(completion.usage),
  }));
}

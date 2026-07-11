// Chief AI Prompt Machine — model routing benchmark table

export const BENCHMARKS = [
  { task: "Complex code debugging", chatgpt: "★★★★★", claude: "★★★★☆", perplexity: "★★☆☆☆", best: "ChatGPT o3 for multi-step root-cause" },
  { task: "TypeScript + Expo code gen", chatgpt: "★★★★★", claude: "★★★★★", perplexity: "★★☆☆☆", best: "ChatGPT or Claude — comparable" },
  { task: "Long-context codebase audit", chatgpt: "★★★★☆", claude: "★★★★★", perplexity: "★★☆☆☆", best: "Claude (200K context window)" },
  { task: "XML/structured system prompts", chatgpt: "★★★★☆", claude: "★★★★★", perplexity: "★★★☆☆", best: "Claude handles XML tags natively" },
  { task: "Live market research (2026)", chatgpt: "★★★☆☆", claude: "★★☆☆☆", perplexity: "★★★★★", best: "Perplexity (real-time web access)" },
  { task: "Competitor intelligence", chatgpt: "★★★☆☆", claude: "★★☆☆☆", perplexity: "★★★★★", best: "Perplexity (live sources + citations)" },
  { task: "Trend scanning (last 6mo)", chatgpt: "★★★☆☆", claude: "★★☆☆☆", perplexity: "★★★★★", best: "Perplexity — time-bounded research" },
  { task: "Adversarial redteam", chatgpt: "★★★★★", claude: "★★★★★", perplexity: "★★★☆☆", best: "ChatGPT or Claude" },
  { task: "Long-form strategy writing", chatgpt: "★★★★☆", claude: "★★★★★", perplexity: "★★★☆☆", best: "Claude for nuanced prose" },
  { task: "Unit economics modeling", chatgpt: "★★★★★", claude: "★★★★☆", perplexity: "★★☆☆☆", best: "ChatGPT with Advanced Data Analysis" },
  { task: "Auth / security audit", chatgpt: "★★★★★", claude: "★★★★☆", perplexity: "★★☆☆☆", best: "ChatGPT o3 or Claude for reasoning depth" },
  { task: "Pricing research", chatgpt: "★★★★☆", claude: "★★★☆☆", perplexity: "★★★★★", best: "Perplexity for live benchmark data" }
];

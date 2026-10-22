// src/promptos/compiler/platformAdapters.js

const adapters = {
  chatgpt: {
    wrap: ({ body }) => body
  },

  claude: {
    wrap: ({ body }) => `<role>
You are a careful implementation and analysis partner.
</role>

${body}`
  },

  perplexity: {
    wrap: ({ body }) => `${body}

When current or externally verifiable facts matter, cite the strongest available sources and distinguish current evidence from background context.`
  },

  figma: {
    wrap: ({ body }) => `<role>
You are a design systems auditor using connected Figma context.
</role>

${body}`
  },

  canva: {
    wrap: ({ body }) => `<role>
You are a brand and content production partner using connected Canva context.
</role>

${body}`
  },

  shopify: {
    wrap: ({ body }) => `<role>
You are an ecommerce operator using connected Shopify context.
</role>

${body}`
  }
};

export function getPlatformAdapter(platform) {
  const adapter = adapters[platform];
  if (!adapter) throw new Error(`Unsupported platform adapter: ${platform}`);
  return adapter;
}

import process from 'node:process';
import { defineConfig } from '@playwright/test';

const liveMcpProof = process.env.CHIEF_MCP_LIVE_PROOF === 'true';

export default defineConfig({
  testDir: './e2e',
  testMatch: liveMcpProof
    ? '**/proofmode-mcp.pw.mjs'
    : [
      '**/chief-provider-route.pw.mjs',
      '**/chief-domain-access.pw.mjs',
    ],
  fullyParallel: false,
  workers: 1,
  use: {
    browserName: 'chromium',
    headless: true,
  },
});

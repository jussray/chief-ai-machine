import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const proofModeSource = read('worker/proofmode-mcp.js');
const founderControl = JSON.parse(read('.control-room/founder-control.contract.json'));
const mcpConfig = JSON.parse(read('.mcp.json'));

function fcrServer(config) {
  return config?.mcpServers?.['founder-control-room']
    ?? config?.servers?.['founder-control-room']
    ?? null;
}

describe('Chief + FCR MCP role boundary', () => {
  it('keeps FCR as the canonical external authority surface', () => {
    expect(founderControl.canonicalAuthority.repository).toBe('jussray/founder-control-room');
    expect(founderControl.rules.chiefMaySelfAuthorize).toBe(false);
    expect(founderControl.rules.surfaceMaySelfAuthorize).toBe(false);
    expect(founderControl.rules.executionRequiresExactProposalBinding).toBe(true);
    expect(founderControl.rules.executionReceiptRequired).toBe(true);
    expect(founderControl.rules.providerSuccessIsOutcomeProof).toBe(false);
  });

  it('keeps the Chief ProofMode MCP read-only and non-mutating', () => {
    expect(proofModeSource).toContain("name: 'audit_repository'");
    expect(proofModeSource).toContain('readOnlyHint: true');
    expect(proofModeSource).toContain('destructiveHint: false');
    expect(proofModeSource).toContain('idempotentHint: true');
    expect(proofModeSource).toContain('ProofMode is read-only.');

    const authorityShapedTool = /name:\s*['"](?:execute|merge|deploy|publish|delete|write|mutate|approve|authorize)/i;
    expect(authorityShapedTool.test(proofModeSource)).toBe(false);
  });

  it('connects to the governed FCR MCP without committed credentials', () => {
    const server = fcrServer(mcpConfig);
    expect(server).toBeTruthy();

    const endpoint = server.url ?? server.endpoint;
    expect(endpoint).toBe('https://api.foundercontrolroom.org/mcp');
    expect(server.headers).toBeUndefined();
    expect(server.token).toBeUndefined();
    expect(server.authorization).toBeUndefined();
  });
});

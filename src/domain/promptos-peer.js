export const PROMPTOS_PEER_INTEGRATION_CONTRACT = 'juss/promptos-peer-integration@v1';

export const PROMPTOS_PRODUCT = Object.freeze({
  product: 'PromptOS',
  repository: 'jussray/promptos',
  role: 'human-ai-operating-layer',
  portability: 'host-neutral',
  authority: 'advisory-only',
});

function clean(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function createPromptOSPeerIntegration(input = {}) {
  const consumer = clean(input.consumer, 160);
  if (!consumer) throw new Error('PromptOS peer integration requires a consumer identity');

  return Object.freeze({
    contract: PROMPTOS_PEER_INTEGRATION_CONTRACT,
    ...PROMPTOS_PRODUCT,
    relationship: 'peer-integration',
    ownership: 'independent-product',
    consumer,
    targetProject: clean(input.targetProject, 200),
  });
}

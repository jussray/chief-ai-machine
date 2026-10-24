const DEFAULT_TOLERANCE_SECONDS = 300;

function parseStripeSignatureHeader(signature) {
  const fields = signature.split(',').map((part) => part.trim());
  const timestamp = fields.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = fields
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))
    .filter(Boolean);
  return { timestamp, signatures };
}

function hexToBytes(hex) {
  if (!/^[a-f0-9]{64}$/i.test(hex)) {
    return null;
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
}

export async function verifyStripeWebhookSignature(body, signature, secret, options = {}) {
  if (typeof body !== 'string' || !signature || !secret) {
    return false;
  }

  try {
    const { timestamp, signatures } = parseStripeSignatureHeader(signature);
    const timestampSeconds = Number(timestamp);
    if (!Number.isSafeInteger(timestampSeconds) || timestampSeconds <= 0 || signatures.length === 0) {
      return false;
    }

    const toleranceSeconds = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
    const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (!Number.isFinite(toleranceSeconds) || toleranceSeconds < 0) {
      return false;
    }
    if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) {
      return false;
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const signedContent = encoder.encode(timestamp + '.' + body);

    for (const candidate of signatures) {
      const signatureBytes = hexToBytes(candidate);
      if (!signatureBytes) {
        continue;
      }
      if (await crypto.subtle.verify('HMAC', key, signatureBytes, signedContent)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Stripe webhook verification error:', error);
    return false;
  }
}

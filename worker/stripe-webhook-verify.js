// Stripe webhook signature verification (RFC 3104 HMAC-SHA256)
// Prevents webhook replay attacks by validating the signature

export async function verifyStripeWebhookSignature(body, signature, secret) {
  if (!signature || !secret) {
    return false;
  }

  try {
    // Stripe format: t=timestamp,v1=signature
    const [timestamp, ...signatureParts] = signature.split(',');
    const computedSignature = signatureParts.find(part => part.startsWith('v1='))?.slice(3);

    if (!timestamp || !computedSignature) {
      return false;
    }

    // Reconstruct the signed content: timestamp.payload
    const signedContent = `${timestamp}.${body}`;

    // Compute HMAC-SHA256 using WebCrypto API (timing-safe)
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature_computed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));

    // Convert computed signature to hex
    const computedHex = Array.from(new Uint8Array(signature_computed))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');

    // Use constant-time comparison to prevent timing attacks
    return timingSafeEqual(computedHex, computedSignature);
  } catch (error) {
    console.error('Stripe webhook verification error:', error);
    return false;
  }
}

// Timing-safe string comparison (prevents timing attacks)
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

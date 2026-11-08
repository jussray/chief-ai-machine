# Cookie and Session Contract

Chief AI Machine currently sets zero cookies.

The present runtime is a vanilla SPA. A cookie created by client JavaScript would be self-asserted browser state, not authenticated identity, tenant isolation, private storage, billing authority, or model-execution permission.

## Forbidden

- `document.cookie` or Cookie Store API use;
- custom `Set-Cookie` handling;
- auth, role, provider, billing, workspace, or model state in a cookie;
- proprietary prompts, credentials, keys, or privileged provider output in browser storage;
- analytics, advertising, fingerprinting, replay, or cross-site tracking cookies.

## Future gate

A future backend may add a strictly necessary session cookie only after identity, tenant isolation, server validation, revocation, CSRF, no-store caching, expiry, logout, and deployment boundaries are implemented and verified. A Figma prototype or client-side role toggle is not that proof.

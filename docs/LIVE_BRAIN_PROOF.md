# Live Brain Proof

This branch is reserved for runtime intelligence verification work.

A provider integration is not considered live merely because provider code or secrets exist. A live brain claim requires all of the following evidence on the deployed runtime:

1. Runtime identity exposes the exact deployed release SHA.
2. Provider state is reported without exposing secrets.
3. A bounded inference request reaches the configured provider.
4. The response returns a provider response identity/evidence reference.
5. Playwright or an equivalent browser/runtime test proves the user-facing path reaches the runtime.
6. The proof fails closed when the provider is absent, the release identity mismatches, or the response lacks provenance.

No merge decision should be made from this document alone. The implementation, CI results, deployment identity, and runtime proof are authoritative.

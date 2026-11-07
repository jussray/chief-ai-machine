# Runtime First-Class Kernel

Runtime evidence outranks narrative. Preserve the exact request and exact observed response as immutable evidence. Diagnose the last execution boundary proven to have received the request and the first forward transition that cannot be proven.

## Attribution rule

`WHO` is forensic attribution and remains `UNKNOWN` until the actor that produced the observed outcome is proven. Do not attribute an error, refusal, redirect, success, or message to a component merely from HTTP status, provider code, response text, branding, or customer-visible wording.

Prospective authority is separate. An executor may be PROVEN while authority is UNAUTHORIZED or UNKNOWN; an authorized action may still have UNKNOWN executor attribution.

Every useful 5W1H slot carries:

```text
VALUE: <observed value | UNKNOWN>
STATUS: VERIFIED | INFERRED | PARTIAL | UNKNOWN | BLOCKED | STALE | DISPROVEN
EVIDENCE: <source + locator>
```

Minimum runtime verification requires WHAT, WHERE, WHEN, and the relevant environment/artifact binding. Do not call a state VERIFIED when required executor/version/environment bindings are absent.

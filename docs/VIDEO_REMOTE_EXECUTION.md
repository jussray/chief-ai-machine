# Chief video remote execution

Chief owns its video render jobs and receipts. Queueing a render request grants render authority only for the bounded job and never grants publish authority. Workers must verify project namespace, request fingerprint, output digest, and renderer evidence before marking a job complete.

The queue contract is intentionally transport-neutral. A filesystem-backed queue is the local/CI reference implementation; a hosted queue may replace the transport later without changing Chief's authority or receipt semantics.

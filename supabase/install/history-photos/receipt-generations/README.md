# Explicit receipt generations — local 60422 only

Not approved for production. No automatic renewal or operating-service activation.
Order: `001_install.review.sql` → owner-hardening `003` → receipt-lookup `005` →
`007_generations.local-approved.sql`. Apply using `apply-local.cjs` only after the
pinned project/container/port check. It backs up the photo schema and executes the
migration plus `008_verify.read-only.sql` atomically. Existing rows are untouched.
Reinstallation uses the generation-aware read-only verifier; it does not reapply DDL.

Generation zero remains in `receipts`. Append-only evidence in `receipt_generations`
links the original and immediately preceding receipt, a unique recovery request,
job and generation. Only `consumed` is updated by the existing worker commit RPC.
A new generation is issued only after the preceding unconsumed receipt really expires,
with locked activity/job/receipt CAS, unchanged immutable evidence and current admin.
The attestor alone can inspect and issue. The worker still has only commit EXECUTE,
no direct table rights. Read helpers receive SELECT on necessary columns through RLS.

`createReceiptGenerationRecovery.revalidate` is an explicit server-only operation:
fresh OIDC and independent administrator check, real temporary/final download,
bounded decoding, size/hash/path comparison, state/version recheck, then issuance.
`createGenerationFinalizer` reads the already issued generation and reuses the existing
receipt lookup, file verifier and worker commit. No issuance on retries or lookups.
A lost issuance response requires state inspection; never reset timestamps or auto-reissue.
The new seal binds evidence/generation/predecessor/request, but is not a substitute
for attestor authentication. SQL cannot prove external downloads: the attestor credential
must remain exclusively behind the trusted server verifier. Local HS256/OIDC issuers
are not production authentication.

Private-state row must already exist. A scope-owner guard holds FOR SHARE against
visibility changes; its version is checked at issuance, lookup and commit. Missing row,
CAS change, expired/newer/consumed receipt, revoked administrator, epoch mismatch,
missing/mismatching bytes or uncertain IO blocks recovery. Existing complete jobs never
issue new generations. Actual deletion, temp-upload termination and production rollout
remain disabled/unproven.

`node .../receipt-generations/test-local.cjs` creates only new isolated private fixtures.
It waits for REAL five-minute expiry (no timestamp edits), tests concurrent issuance,
restricted commit, stale receipt rejection and a child process exit after durable issuance.
The result contains checks only; private fixture/context files stay mode 0600 in the lab.

Recovery on installation failure: transaction rolls back. After successful use, do not
run old verifier/DDL or drop generations. Stop the new operation and preserve rows/files;
review schema backup plus append-only history before any separately approved rollback.

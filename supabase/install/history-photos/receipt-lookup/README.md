# Existing attestor receipt lookup — local60422 only

No new receipt store or issuer is created. The existing private receipts table is
read through lookup_receipt(job, request, receipt, actor). Only the attestor can
execute it; worker/anon/authenticated get no SELECT or lookup EXECUTE. The function
is owned by the existing NOLOGIN photo_finish_owner with search_path=''.

The RPC verifies current administrator/job/epoch/revision, unconsumed receipt,
DB-generated seal recomputation and issued_at (maximum age five minutes). The
seal is an unkeyed integrity digest, NOT standalone issuer authentication. Trust
comes from the authenticated restricted DB source and its protected row, then
independent final-file re-read/hash/size/decode. The adapter issues no receipts.
The unchanged attestor remains the sole normal issuer after verified file readback.

server-receipts.ts requires both workload OIDC and an independent administrator
session, looks up twice around actual file verification and never caches acceptance.
Binding mismatch, file errors, expired/missing/consumed receipt or source outage
return null; the worker cannot proceed. The existing commit RPC also checks the
same five-minute age AFTER its existing row locks, so expiry while waiting is denied.
Its signature/roles/one-use consume semantics do not change.

Expiry does not refresh issued_at. An old pending receipt cannot be automatically
reissued because the existing store is UNIQUE(job). It stays blocked for explicit
recovery review; no deletion or fake renewal is implemented. Recovery after a lost
commit response must inspect the job independently; a consumed receipt is not
accepted again. Existing finalized-job recovery still rechecks immutable file bytes.

005 is an explicit local overlay, NOT production SQL. 006 checks its exact function
body/owner/search_path/ACL and the adjusted commit body. The baseline v1 and owner
v2 packages remain intact. install-local detects this overlay and uses 006 without
automatically upgrading any other existing database. The standalone Node source
uses TLS in production; its explicit loopback60422 test profile is read-only.

Actual integration (new test data only, existing ordinary/admin accounts reused):
`node supabase/install/history-photos/test-clean-lab.cjs ROOT --receipts`
It uses the real Node attestor source, actual Storage byte decoding/readback, the
existing worker RPC, concurrent finalize requests and a process exit AFTER durable
attestation before worker consumption. Existing data/files are preserved; fixtures
finish private. OIDC is local RSA/JWKS, NOT real Vercel OIDC. Operational credentials,
issuer/hosting/TLS and deployment remain unconfigured and inactive.

Latest overlay note: the paragraph above describes 005 alone. After explicit
007/008 installation, new append-only generations can be issued only through
fresh server file/admin revalidation. The old receipt is never renewed or reused.
Use the generation-aware verifier after that upgrade; do not revert to 006.

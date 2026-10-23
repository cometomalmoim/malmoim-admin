# Standalone HTTPS photo broker

Node.js 22+; no Next.js listener, cloud SDK or Unix socket is required by the service.
The operator must supply a TLS certificate/key and a trusted adapter. An operational composition adapter exists, but real production dependencies are
**not configured**. There is no automatic environment-based activation.

```sh
node services/history-photo-broker/build.cjs /private/tmp/photo-broker-bundle
node services/history-photo-broker/main.cjs \
  --bundle /private/tmp/photo-broker-bundle \
  --cert /secure/tls.crt --key /secure/tls.key --host 127.0.0.1 --port 8443
```

Without `--adapter`, liveness returns 200, readiness and photo operations return
503. The TLS private key must have owner-only permissions. SIGTERM/SIGINT stops
accepting requests, drains existing requests and exits (10-second upper bound).
No secrets or request bodies are logged. Hosting must additionally provide rate
limits, certificate renewal, resource limits and process supervision.

An explicitly selected operator-owned `--adapter FILE --config FILE` exports
`createPorts({modules, configPath})`, implementing `PhotoBrokerPorts` in
`src/lib/history-activities/service-handler.ts`. The included
`local-lab-adapter.cjs` is **only** for the pinned existing 58422 lab: it uses
Docker/psql and the local Auth signing secret, not an operational issuer.
Its private configuration is never shipped to Next.js or accepted over HTTP.
The operator bootstrap must independently supply pinned OIDC/JWKS,
getUser/admin_users checks, restricted DB connections and scoped Storage tokens.

All operation requests are JSON metadata only (16 KiB maximum), POST:

| Endpoint | Contract |
| --- | --- |
| `/v1/activities` | requestId, title, date (YYYY-MM-DD), description |
| `/v1/reservations` | requestId, activityId, revision, size, mime |
| `/v1/inspect` | activityId |
| `/v1/permits` | permitRequestId, jobId, requestId (original reservation) |
| `/v1/finalize`, `/v1/recover` | jobId, requestId |
| `/v1/layout` | requestId, activityId, revision, order (all photo IDs), cover |
| `/v1/visibility` | requestId, activityId, revision, published |
| `/v1/public` | activityId; workload authentication required, no user session |

Writes require both Authorization: Bearer (OIDC) and x-photo-user-session
(independently validated Supabase user session). Neither user IDs, receipts nor
roles are accepted from requests. Browser file bytes go directly to the exact
reserved temporary Storage path. Duplicate permit issuance is denied, including
a lost-response retry: an uncertain claim needs operator investigation.
Public responses expose only presentation metadata and 60-second final-file
read URLs. The hosting application remains responsible for presenting public
results to visitors; visitors do not receive workload or Storage credentials.
There is no list-everything, delete, role-selection or arbitrary SQL endpoint.

## Explicit local integration

```sh
node services/history-photo-broker/integration.cjs
```

This manual command requires Docker/local-network approval. It rechecks exact
container IDs/58421/58422 ports before access; applies only the new isolated
`supabase/local/broker-service/001.sql` when absent; creates NEW test activities,
files and an ordinary-member fixture; preserves all old rows/files; and leaves
its own activities private. It starts, stops and restarts only its own OS
processes on free ports, including a process exit after immutable readback.
Results and private credentials remain under an owner-only broker-service-*
directory in the existing lab. Nothing is deleted. Existing services remain
running. The SQL is local-only, not a production migration. Its ownership/grants were applied incrementally in this lab. For the separately
verified clean installation package and subsequent security overlays, use
`supabase/install/history-photos/README.md`; do not treat this historical lab SQL
as the deployment package.

Actual Vercel OIDC, production Storage-token issuer, hosting, TLS deployment and
operational DB-role provisioning remain unverified. Read URL revocation is not
instant. Temporary signed-upload request termination is not proven; late writes
stay isolated from immutable final paths. No deletion safety is claimed.

## Restricted PostgreSQL driver (explicit, inactive by default)

Install the separately locked broker dependency with
`npm ci --prefix services/history-photo-broker --ignore-scripts`.
`postgres-driver.cjs` implements PhotoPool through pg 8.23.1. The optional
`createNodePostgresWorker` composition requires reviewed credentials, real receipt
resolution, administrator/workload checks and lifecycle handling. No existing
route or adapter is automatically switched to this driver.

Only the pinned role audit and parameterized `photo_finish_v2.commit(jsonb)` are
allowed. The driver audits the actual role before the callback, clears request
claims with transaction-local settings, caps connections at two, enforces server
statement/lock timeouts and destroys each checked-out physical connection after
its transaction. This deliberately favors isolation over warm connection reuse.
`close()` rejects new work and terminates checked-out sockets before draining the
pool; the service operator must wire it into the broker shutdown lifecycle.

Production requires verified TLS and rejects URI SSL overrides. Local test mode
is restricted to loopback60422, always BEGIN READ ONLY, and exposes only fixed
read-only probes. The current local PostgreSQL server has SSL off: plaintext was
used only for this local read-only test, not as a production fallback. Production
TLS/hosted-pooler behavior remains unverified. No successful receipt consumption
is claimed by that test. Query/commit response loss remains uncertain and is never
automatically replayed. All SQL/transport errors are sanitized.

```sh
node services/history-photo-broker/postgres-read-only.cjs
```

## Current operational composition — inactive until trusted bootstrap

`operational-adapter.cjs` reuses `broker-composition.ts`. `main.cjs` supplies
modules/configPath; a reviewed operator wrapper must construct and explicitly pass
trusted `dependencies`. Selecting this adapter or adding configuration alone does
not authenticate any port. Missing dependencies fail closed; no local issuer fallback.

The composition reuses restricted worker/receipt resolution, limited Storage issuer,
public snapshot reader and explicit generation recovery. It isolates per-request
OIDC/user-session/abort context, tracks pools and HTTPS resources, closes late-created
pools, and makes shutdown idempotent. Timeout/disconnect does not prove remote work
stopped and never triggers automatic replay. Generation revalidation/resume are
explicit server methods; `/v1/recover` does not automatically issue a new receipt.

Main/build both deliver 12 modules, including `storage-token-issuer` and
`broker-composition`. Composition tests exercised real local HTTPS and child-process
start/stop with **mock ports**, not a production DB or issuer. Previous independent
DB/Storage integration is a separate local validation layer. Latest recorded suite:
879 passed; TypeScript/build passed; lint 0 errors, 2 existing unrelated warnings.
These checks were not repeated for the handoff documentation update.

Actual Vercel identity, production token issuer/replay store, role credentials,
TLS/pooler and operator bootstrap remain unverified. See
`supabase/drafts/HISTORY-PHOTO-VERCEL-HANDOFF.md` for the checklist and safe sharing scope.

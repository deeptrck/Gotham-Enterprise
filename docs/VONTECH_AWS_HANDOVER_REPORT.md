# Deeptrack Gotham and Sentinel
## Engineering and Production Handover Report for Vontech

**Prepared for:** Vontech engineering and DevOps team  
**Prepared by:** Deeptrack engineering  
**Date:** 26 August 2026  
**Scope:** Gotham Enterprise and Sentinel only

> The Deeptrack data room is explicitly outside this handover and outside the Vontech contract. This report covers only the Gotham and Sentinel platforms, their identity and authorization systems, Gotham’s proprietary AWS model integration, and the production operations required for those two products.

## 1. Executive summary

Gotham and Sentinel have completed a major application engineering and security-hardening phase. Gotham’s final software changes were reviewed with CodeRabbit, validated, and merged into `main`. Sentinel’s Auth0 migration and Convex customer-authorization gate are deployed to production, with internal administrator access configured for the approved Deeptrack engineering team.

Gotham now treats the proprietary AWS-hosted Gotham model as the only production verification provider. It fails closed when the model endpoint is unavailable or not configured, refunds credits after failed inference, normalizes defensive model responses, and exposes a safe backend readiness endpoint. The Gotham frontend includes the Deeptrack enterprise landing page, client administration portal, and Deeptrack internal back office.

Sentinel uses Auth0 for identity and Convex for customer-level authorization. The application requires an explicit active workspace/customer assignment for ordinary users and preserves a fail-closed boundary. Approved internal administrators can access the product-wide administration path without weakening tenant isolation for regular users.

Vontech’s remaining responsibility is infrastructure and operational completion: deploy and secure the proprietary model, provide the SageMaker endpoint contract, complete Gotham’s AWS runtime configuration, support the controlled PostgreSQL migration, and validate production behavior. Sentinel operations require verification of Auth0, Convex, Vercel, monitoring, and deployment settings. No data-room work is included.

## 2. Repository and merge status

| Platform | Repository | Current status |
|---|---|---|
| Gotham | `deeptrck/Gotham-Enterprise` | Final software changes merged into `main` |
| Sentinel | `deep-track/Sentinel` | Auth0 and Convex authorization changes pushed to `main` and deployed to production |

Gotham pull request #2 was squash-merged into `main` with merge commit:

```text
94a72145cefd8b4b253711f4abbb26ec0fa7d59a
```

The final Gotham software validation passed `npm run build`, `npm run lint`, and `git diff --check`. The remaining lint output contains two pre-existing image optimization warnings in the results pages and no new errors from the merged work.

## 3. Gotham software delivered

### 3.1 Proprietary AWS model enforcement

The Gotham scan route no longer silently routes customer media to Reality Defender or another temporary third-party provider. It checks whether the proprietary model is configured before charging credits. If the endpoint is absent, Gotham returns HTTP `503` and does not charge the user.

The SageMaker adapter uses the AWS SDK default credential chain. It sends raw media bytes with the original MIME type and requests a JSON response. The adapter accepts compatible model fields including `label`, `verdict`, `status`, `is_deepfake`, `score`, `confidence`, `model`, `version`, `request_id`, and `metadata`. It also accepts the initial release aliases documented in the model contract.

Scores are normalized to `0..1` and clamped. Product verdicts are mapped as follows:

| Model output | Gotham verdict |
|---|---|
| `FAKE`, `DEEPFAKE`, `MANIPULATED` | `DEEPFAKE` |
| `REAL`, `AUTHENTIC`, `GENUINE` | `AUTHENTIC` |
| `UNCERTAIN` or unknown | `SUSPICIOUS` |

The adapter uses a bounded timeout controlled by `GOTHAM_MODEL_TIMEOUT_MS`, defaulting to 45 seconds. Empty, malformed, non-JSON, and unexpected responses fail safely. When inference fails after a credit is charged, the credit is refunded.

### 3.2 Gotham backend readiness

Gotham exposes `GET /api/health`. The endpoint reports only non-sensitive readiness metadata, including whether a database and proprietary model are configured. It returns HTTP `503` when required integrations are absent and does not expose credentials, tokens, raw media, or model secrets.

The endpoint is a readiness signal and does not replace live inference testing with approved model test media.

### 3.3 Gotham enterprise frontend

The public Gotham landing page has been replaced with a Deeptrack enterprise experience. Authenticated surfaces include:

| Route | Audience | Scope |
|---|---|---|
| `/client-admin` | Customer administrators | Workspace health, usage, risk activity, API access, team access, and security posture |
| `/backoffice` | Deeptrack internal operators | Clients, scan logs, credits, billing, model feedback, forensics, API keys, webhooks, audit, and system settings |
| `/dashboard`, `/results`, `/history` | Authenticated product users | Media verification and result history |

The client-admin metrics panel now surfaces an error when the dashboard or usage APIs return non-OK responses. It no longer renders misleading zero metrics after an API failure.

## 4. Sentinel software and security delivered

### 4.1 Auth0 migration

Sentinel migrated from Clerk to Auth0 SDK v4. The implementation includes Auth0 session management, Google authentication, callback and logout handling, and a token bridge at `/api/auth/token` for the Convex client.

A previous Google login failure was traced to an Auth0 organization requirement. The callback flow was corrected so approved users can authenticate without the earlier organization-parameter failure.

### 4.2 Convex authorization

Sentinel’s production Convex deployment is:

```text
https://insightful-lark-924.convex.cloud
```

The production-registered authorization query is:

```text
watchlists.currentAccess
```

This query verifies the authenticated identity, active customer/workspace assignment, membership status, and role. Ordinary users cannot access customer data without explicit active authorization. The application intentionally fails closed when authorization cannot be verified.

The earlier `dashboard:currentAccess` function-not-found error was resolved by anchoring the public authorization query in the deployed `watchlists` module. The production Convex deployment was completed without deleting existing indexes or data.

### 4.3 Internal administrator access

Sentinel supports an internal administrator path for approved Deeptrack developers. The approved internal identities are:

| Identity | Purpose |
|---|---|
| `bryan@deeptrack.io` | System developer and internal administrator |
| `barbarawangui2002@gmail.com` | Frontend engineering and internal administration |
| `stacymacharia08@gmail.com` | Product engineering and internal administration |

Internal administrators can access product-wide administration without requiring a customer workspace membership. This does not weaken normal tenant isolation or grant the same bypass to ordinary users.

Auth0 role claims remain the preferred primary control. The production Convex internal-admin configuration exists as a deterministic bootstrap/fallback path and must be reviewed periodically.

### 4.4 Redirect and onboarding fixes

The `/new-user` onboarding flow was cleaned of legacy API calls. A Next.js routing defect where `redirect()` was caught as an ordinary exception was fixed; expected redirects no longer render a false “Access service unavailable” state.

A user without an active workspace should see the normal access-pending flow. That is an authorization result, not an infrastructure failure.

## 5. Gotham AWS model contract for Vontech

Vontech must provide the following values through the approved protected configuration channel:

| Requirement | Value to provide |
|---|---|
| SageMaker endpoint name | `SAGEMAKER_ENDPOINT_NAME` |
| Endpoint ARN | Full AWS resource identifier |
| AWS region | `SAGEMAKER_REGION` or `AWS_REGION` |
| Model artifact | `GOTHAM_MODEL_S3_URI` |
| Model name | `GOTHAM_MODEL_NAME` |
| Model version | `GOTHAM_MODEL_VERSION` |
| Timeout expectation | `GOTHAM_MODEL_TIMEOUT_MS` |
| Supported MIME types | Image, video, and audio support/restrictions |
| Request size limits | Maximum body and per-media limits |
| Response schema | JSON fields and score semantics |
| Invocation mode | Synchronous real-time endpoint or approved alternative |
| Execution role | Application invocation permissions |
| Network path | VPC/private endpoint requirements |

The current adapter expects a JSON-compatible response such as:

```json
{
  "label": "REAL | FAKE | UNCERTAIN",
  "score": 0.0,
  "confidence": 0.0,
  "model": "gotham-core",
  "version": "2026.08.01",
  "request_id": "optional",
  "metadata": {}
}
```

The model endpoint must not require credentials in the browser. Gotham expects IAM roles or protected runtime credentials through the AWS SDK default credential chain.

## 6. Gotham PostgreSQL migration boundary

Gotham currently uses MongoDB/Mongoose at runtime. The initial PostgreSQL foundation is present at:

```text
db/postgres/001_initial.sql
```

The schema covers users, Auth0 identities, organizations, memberships, scans, verification results, API keys, usage, payments, and audit events. It treats `users.id` as the canonical relational identity reference; scan and verification records should not store an independently mutable Auth0 subject.

The runtime application has not yet been fully switched from MongoDB to PostgreSQL. The safe migration sequence is:

1. Provision PostgreSQL/RDS with TLS, backups, private networking, and connection limits.
2. Review and apply the schema.
3. Inventory MongoDB collections, indexes, counts, and relationships.
4. Build an idempotent backfill preserving source IDs and raw model payloads in `jsonb`.
5. Convert legacy `clerkId` references to Auth0 `auth0_sub` with a temporary mapping strategy.
6. Reconcile users, organizations, scans, results, usage, payments, and audit records.
7. Introduce a PostgreSQL repository behind existing API contracts.
8. Run shadow reads or controlled dual-write validation.
9. Switch reads by domain area while retaining MongoDB read-only for rollback.
10. Archive MongoDB only after reconciliation and backup verification.

## 7. Sentinel production operations

Vontech should verify or operate the following Sentinel production dependencies according to the agreed ownership model:

| Area | Required verification |
|---|---|
| Auth0 | Correct tenant, client, callback URLs, logout URLs, allowed origins, Google connection, organization policy, and role claim configuration |
| Convex | Production deployment `insightful-lark-924`, deployed public functions, environment variables, logs, indexes, and no destructive schema changes |
| Vercel | Production project linked to the Sentinel repository, latest `main` deployment READY, correct production alias, and required environment variables |
| Identity | Auth0 subject mapping, internal administrator role/allowlist, customer membership assignment, and access-pending behavior |
| Monitoring | Auth0 callback errors, Convex function failures, authorization denials, Vercel errors, and abnormal access patterns |
| Recovery | Known-good Git commits, Convex deployment state, Vercel rollback target, and documented incident ownership |

Sentinel acceptance must verify that a normal user without an active workspace cannot access customer data, a valid customer member can access only the assigned workspace, an internal administrator can access approved product-wide administrative views, and backend authorization failures never fail open.

## 8. Production security acceptance checklist

### Gotham

| Test | Expected result |
|---|---|
| Missing SageMaker endpoint | HTTP `503`; no credit charge |
| Valid authentic media | `AUTHENTIC` result with model name and version |
| Valid manipulated media | `DEEPFAKE` result with normalized score |
| Ambiguous media | `SUSPICIOUS` result |
| Malformed model response | Safe error; provider internals not exposed |
| SageMaker timeout | Safe error; charged credit refunded |
| Endpoint unavailable | Safe error; no third-party detector invoked |
| Oversized/unsupported media | Rejected before inference |
| Wrong Auth0 issuer/audience | Request rejected |
| Cross-customer access | Request rejected |
| Health endpoint | No credentials, tokens, or media disclosed |

### Sentinel

| Test | Expected result |
|---|---|
| Google/Auth0 login | Successful callback for approved users |
| Invalid callback state | Rejected safely |
| User without membership | Access-pending page, no customer data |
| Active customer member | Access limited to assigned customer/workspace |
| Internal administrator | Approved product-wide admin access |
| Convex outage/error | Fail-closed response, not broad access |
| Role tampering | Backend rejects unauthorized role claims |
| Cross-customer request | Backend rejects request |
| Sign-out | Auth0 session and application session are cleared |
| Onboarding redirect | Expected Next.js redirect is not rendered as an error |

## 9. Environment and secret handling

No AWS access keys, Auth0 client secrets, database passwords, tokens, or model credentials may be committed to either repository. Use IAM roles, Secrets Manager, protected Vercel variables, protected Convex environment variables, or the approved Vontech secret-management system.

### Gotham variables

```text
AUTH0_DOMAIN=<Gotham Auth0 tenant>
AUTH0_CLIENT_ID=<Gotham Regular Web Application client ID>
AUTH0_CLIENT_SECRET=<protected secret>
AUTH0_SECRET=<protected session secret>
APP_BASE_URL=<production Gotham URL>
AUTH0_AUDIENCE=https://api.deeptrack.io/gotham
AWS_REGION=<approved region>
GOTHAM_MODEL_PROVIDER=proprietary
SAGEMAKER_ENDPOINT_NAME=<Vontech endpoint>
SAGEMAKER_REGION=<endpoint region>
GOTHAM_MODEL_NAME=gotham-core
GOTHAM_MODEL_VERSION=<approved version>
GOTHAM_MODEL_TIMEOUT_MS=45000
DATABASE_URL=<PostgreSQL connection after migration>
MONGODB_URI=<temporary MongoDB connection during migration only>
```

`REALITY_DEFENDER_ENABLED` must remain false in production. The third-party provider is not an accepted fallback for Gotham production verification.

### Sentinel variables and controls

Sentinel’s Auth0 domain, client identifiers, callback/logout URLs, Convex deployment URL, Convex environment variables, Vercel production variables, and internal administrator configuration must be managed through protected deployment settings. No identity provider secret or Convex deploy credential should appear in Git.

## 10. Deployment and handoff sequence

Vontech should execute the following sequence for the two contracted platforms:

1. Confirm AWS account, region, IAM ownership, and protected secret-management workflow for Gotham.
2. Deploy or confirm the proprietary SageMaker model endpoint.
3. Validate model invocation with approved non-sensitive media.
4. Provision PostgreSQL/RDS and apply the reviewed Gotham schema.
5. Deploy Gotham’s configured runtime and verify `GET /api/health`.
6. Run Gotham authenticated API and model acceptance tests.
7. Verify Sentinel’s Auth0 tenant and Google connection settings.
8. Verify Sentinel’s production Convex deployment and public authorization function.
9. Verify Vercel’s production deployment and environment variables for Sentinel.
10. Run Sentinel identity, customer authorization, administrator, and fail-closed tests.
11. Configure monitoring, alerts, retention, rollback artifacts, and incident ownership for both products.
12. Record production identifiers, deployed versions, environment owners, and test evidence.

## 11. Ownership boundary

| Workstream | Deeptrack engineering | Vontech / DevOps |
|---|---|---|
| Gotham application code | Implemented, reviewed, and merged | Deploy and operate |
| Gotham SageMaker adapter | Implemented with defensive parsing and timeout | Provide endpoint, IAM, networking, scaling, and monitoring |
| Proprietary model artifact | Define request/response contract | Host artifact and deploy endpoint |
| Gotham PostgreSQL schema | Initial foundation implemented | Provision database, networking, TLS, backups, and secrets |
| MongoDB migration code | Implement next controlled migration phase | Provide production DB operations and rollback support |
| Gotham Auth0 integration | Application flow implemented | Confirm tenant/application configuration and secrets |
| Sentinel Auth0 flow | Migrated and hardened | Verify tenant policy, Google connection, callbacks, claims, and monitoring |
| Sentinel Convex authorization | Customer gate and admin path implemented | Operate deployment, environment, logs, and rollback |
| Sentinel Vercel deployment | Code and production fixes delivered | Operate project, variables, deployments, and rollback |
| Security acceptance | Define test cases and remediate software defects | Execute production evidence and operational controls |
| Observability and incident response | Define signals and safe error behavior | Configure alerts, on-call, retention, and recovery |

## 12. Immediate information required from Vontech

Please return the following before production model validation and infrastructure cutover:

1. Gotham SageMaker endpoint name and ARN.
2. AWS region and model artifact S3 URI.
3. Supported request MIME types, size limits, timeout, and response schema.
4. IAM execution/invocation role and network requirements.
5. PostgreSQL/RDS endpoint strategy, TLS policy, and secret-management method.
6. Gotham production runtime URL and deployment target.
7. Sentinel Auth0 tenant/application confirmation, callback/logout URLs, and role-claim configuration.
8. Sentinel Convex production deployment confirmation and environment ownership.
9. Sentinel Vercel project/deployment ownership and rollback procedure.
10. CloudWatch or equivalent monitoring plan for Gotham and Sentinel.
11. Results of the production acceptance checklists in this document.

## 13. Explicit scope exclusion

The Deeptrack data room is **not part of the Vontech contract** and is intentionally excluded from this report. Its repositories, AWS deployment, S3 storage, CloudFront, ACM, API Gateway, and PostgreSQL work must be handled under a separate ownership agreement and handover document.

## References

1. `docs/GOTHAM_AWS_MODEL_CONTRACT.md` in `deeptrck/Gotham-Enterprise` — Gotham proprietary AWS model request, response, timeout, failure, and acceptance contract.
2. `db/postgres/001_initial.sql` in `deeptrck/Gotham-Enterprise` — initial Gotham PostgreSQL schema foundation.
3. `app/api/scans/route.ts` and `lib/gothamModel.ts` in `deeptrck/Gotham-Enterprise` — proprietary model enforcement and defensive inference adapter.
4. `backend/convex/watchlists.ts` and `backend/convex/lib/rbac.ts` in `deep-track/Sentinel` — production Convex authorization query and RBAC implementation.
5. Pull request #2 in `deeptrck/Gotham-Enterprise` — final reviewed and merged Gotham software changes: https://github.com/deeptrck/Gotham-Enterprise/pull/2

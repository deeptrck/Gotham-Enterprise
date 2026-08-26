# Deeptrack Gotham and Data Room
## AWS Production Handover Report for Vontech

**Prepared for:** Vontech engineering and DevOps team  
**Prepared by:** Deeptrack engineering  
**Date:** 26 August 2026  
**Repositories:** `deeptrck/Gotham-Enterprise`, `deep-track/deeptrack-data-room`

> This document separates the completed application engineering from the remaining AWS infrastructure and production operations. Vontech should use it as the implementation and cutover checklist for Gotham and the Deeptrack investor data room.

## 1. Executive summary

The Gotham software has been hardened and merged into the `main` branch. The application now treats the proprietary AWS-hosted Gotham model as the only production verification provider, fails closed when the model endpoint is not configured, refunds credits after failed model invocation, exposes a safe backend readiness endpoint, and includes defensive response normalization for model output.

The Gotham frontend now contains an enterprise Deeptrack landing page, a protected client-administration portal, and the existing Deeptrack internal back office. A PostgreSQL schema foundation has been added for the planned MongoDB migration, with Auth0 identities represented by `auth0_sub` in the canonical `users` table.

The data room software is also AWS-ready. Its application layer includes Auth0 verification, PostgreSQL-backed grants and audit workflows, private S3 upload/download abstractions, NDA acknowledgement enforcement, document lifecycle operations, and frontend API integration. The data room still requires AWS deployment and live acceptance testing.

Vontech’s remaining responsibility is to provision and connect AWS infrastructure, complete the model endpoint deployment, configure PostgreSQL/RDS and private S3, deploy API Gateway/Lambda and the frontend, configure secrets and IAM, complete TLS/CloudFront, and run the production acceptance checklist.

## 2. Repository and merge status

| Repository | Branch / status | Relevant result |
|---|---|---|
| `deeptrck/Gotham-Enterprise` | `main` | Pull request #2 was squash-merged |
| Gotham merge commit | `94a72145cefd8b4b253711f4abbb26ec0fa7d59a` | Enterprise frontend, proprietary model boundary, backend readiness, and CodeRabbit fixes are in `main` |
| Gotham feature history | `67d1e5f`, `fdc27a5`, `25d1cd8`, `53301bb` | Model enforcement, model hardening, CodeRabbit fixes, admin/schema fixes |
| `deep-track/deeptrack-data-room` | Software implementation branch history | AWS migration foundation and authenticated data-room workflows are implemented |

Gotham’s final CodeRabbit findings were addressed before merge. The final validation passed `npm run build`, `npm run lint`, and `git diff --check`. Lint retains two pre-existing image optimization warnings in the results pages and no new errors from the merged work.

## 3. Gotham software delivered

### 3.1 Proprietary model integration

Gotham no longer silently routes customer media to Reality Defender or another temporary third-party provider. The scan route checks `isGothamModelConfigured()` before charging credits. If the endpoint is not configured, it returns HTTP `503` and does not charge the user.

The adapter invokes SageMaker using the AWS SDK default credential chain. The application sends raw media bytes with the original MIME type and requests a JSON response. Supported product media types are image, video, and audio. Video handling must follow the endpoint’s supported contract; the application can sample video into bounded frames unless Vontech’s endpoint supports native video payloads.

The adapter accepts `label`, `verdict`, `status`, `is_deepfake`, `score`, `confidence`, `manipulation_score`, `fake_probability`, `confidence_score`, `model`, `version`, `request_id`, and `metadata` aliases. Scores are normalized to `0..1` and clamped. Product verdicts are normalized as follows:

| Model output | Gotham verdict |
|---|---|
| `FAKE`, `DEEPFAKE`, `MANIPULATED` | `DEEPFAKE` |
| `REAL`, `AUTHENTIC`, `GENUINE` | `AUTHENTIC` |
| `UNCERTAIN` or unknown | `SUSPICIOUS` |

The model invocation has a bounded timeout controlled by `GOTHAM_MODEL_TIMEOUT_MS`, defaulting to 45 seconds. Empty, malformed, non-JSON, or unexpected response bodies fail safely. If invocation fails after a credit is charged, the credit refund path runs and the user receives a safe model-unavailable response.

### 3.2 Backend readiness

Gotham exposes `GET /api/health`. It reports only safe readiness metadata and does not expose credentials or raw model configuration. It reports whether a database and proprietary model are configured and returns HTTP `503` when either required integration is absent.

The health endpoint is an integration readiness signal, not a substitute for a full model inference test. Vontech must validate the endpoint with approved test media after SageMaker is deployed.

### 3.3 Enterprise frontend

The public Gotham landing page has been replaced with a Deeptrack enterprise experience. The authenticated application includes:

| Route | Audience | Scope |
|---|---|---|
| `/client-admin` | Customer administrators | Workspace health, risk activity, usage, API access, team access, and security posture |
| `/backoffice` | Deeptrack internal operators | Client accounts, scan logs, credits, billing, model feedback, forensics, API keys, webhooks, audit, and system settings |
| `/dashboard`, `/results`, `/history` | Authenticated product users | Media verification and result history |

The client-admin metrics panel now surfaces an error when either dashboard or usage API fails. It no longer replaces failed responses with empty objects that could display misleading zero metrics.

## 4. Data-room software delivered

The data room is designed as an AWS-native system:

| Component | Intended implementation |
|---|---|
| Frontend | Vite React static artifact behind CloudFront |
| API | API Gateway HTTP API and Node.js 20 Lambda |
| Authentication | Auth0 JWT verification with issuer, audience, expiry, subject, and role checks |
| File storage | Private, encrypted, versioned S3 bucket |
| Metadata and audit | PostgreSQL/RDS or Aurora PostgreSQL |
| Secrets | Secrets Manager or protected Lambda configuration |
| Monitoring | CloudWatch logs, alarms, and retention |

Application workflows implemented include access-status checks, NDA acknowledgement, database-backed grants, invitation state handling, clearance enforcement, document listing, upload intents, secure download URLs, document status/version operations, and audit retrieval. Upload-intent consumption and document creation are designed to commit atomically in PostgreSQL.

The production frontend uses the remote API adapter when `VITE_DATA_ROOM_API_BASE_URL` is configured. Local browser-only review behavior must not be used as the production security boundary.

## 5. Required Vontech AWS configuration

### 5.1 SageMaker and model artifact

Vontech must deploy or confirm the proprietary Gotham model and provide the following values through the approved protected configuration channel:

| Requirement | Value to provide |
|---|---|
| SageMaker endpoint name | `SAGEMAKER_ENDPOINT_NAME` |
| AWS region | `SAGEMAKER_REGION` or `AWS_REGION` |
| Model artifact | `GOTHAM_MODEL_S3_URI` |
| Model name | `GOTHAM_MODEL_NAME` |
| Model version | `GOTHAM_MODEL_VERSION` |
| Timeout expectation | `GOTHAM_MODEL_TIMEOUT_MS` |
| Supported MIME types | Image, video, audio support and restrictions |
| Request size limits | Maximum body size and per-media limits |
| Response schema | JSON fields and score semantics |
| Invocation mode | Synchronous real-time endpoint or another supported mode |
| Execution role | SageMaker and application invocation permissions |
| Network path | VPC/private endpoint requirements, if applicable |

The application expects a JSON response compatible with:

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

No AWS access keys should be committed to either repository. Gotham uses the AWS SDK default credential chain and expects IAM roles or protected runtime credentials.

### 5.2 Gotham database migration

Gotham currently uses MongoDB/Mongoose at runtime. The PostgreSQL foundation is present in `db/postgres/001_initial.sql`, but the runtime repository and all production routes have not yet been fully switched to PostgreSQL.

The recommended migration sequence is:

1. Provision PostgreSQL/RDS with TLS, backups, private networking, and connection limits.
2. Review and apply the PostgreSQL schema.
3. Inventory MongoDB collections, indexes, document counts, and relationships.
4. Build an idempotent backfill preserving MongoDB source IDs and raw model payloads in `jsonb`.
5. Migrate legacy `clerkId` identity references to Auth0 `auth0_sub`.
6. Reconcile users, organizations, scans, verification results, usage, payments, and audit records.
7. Introduce the PostgreSQL repository behind the existing API contracts.
8. Run shadow reads or controlled dual-write validation.
9. Switch reads by domain area and retain MongoDB read-only for a defined rollback window.
10. Archive MongoDB only after reconciliation, backup, and rollback verification.

The PostgreSQL schema intentionally treats `users.id` as the canonical identity reference. Scan and verification-result tables should derive the Auth0 subject through the user relationship rather than storing an independently mutable `auth0_sub` value.

### 5.3 Data-room infrastructure

Vontech must provision or confirm:

- A private S3 bucket with Block Public Access, default encryption, versioning, lifecycle cleanup for incomplete uploads, and a secure-transport policy.
- PostgreSQL reachable by Lambda through private networking or an approved RDS connectivity pattern. The database should not be exposed publicly for convenience.
- API Gateway routes for `/health`, `/documents`, `/uploads`, `/documents/{id}/download`, access status, NDA acknowledgement, grants, versions, and audit operations.
- Auth0 issuer, audience, role claim, company/customer claim, callback URL, logout URL, and allowed web origins.
- CloudFront distribution with the approved alternate domain and ACM certificate.
- CloudWatch log retention and alarms for Lambda failures, API 5xx responses, latency, model failures, and abnormal denial rates.

## 6. Environment configuration

### 6.1 Gotham server configuration

Use protected runtime configuration rather than committing secrets:

```text
AUTH0_DOMAIN=<Gotham Auth0 tenant>
AUTH0_CLIENT_ID=<Gotham Regular Web Application client ID>
AUTH0_CLIENT_SECRET=<protected secret>
AUTH0_SECRET=<protected session secret>
APP_BASE_URL=<production Gotham URL>
AUTH0_AUDIENCE=https://api.deeptrack.io/gotham
MONGODB_URI=<temporary MongoDB connection during migration>
DATABASE_URL=<PostgreSQL connection after migration>
AWS_REGION=<approved region>
GOTHAM_MODEL_PROVIDER=proprietary
SAGEMAKER_ENDPOINT_NAME=<Vontech endpoint>
SAGEMAKER_REGION=<endpoint region>
GOTHAM_MODEL_NAME=gotham-core
GOTHAM_MODEL_VERSION=<approved version>
GOTHAM_MODEL_TIMEOUT_MS=45000
```

`REALITY_DEFENDER_ENABLED` must remain false for production Gotham. The old third-party variables are retained only as transition-era configuration and must not be used as a fallback.

### 6.2 Data-room Lambda configuration

```text
AUTH0_ISSUER=https://<tenant>.<region>.auth0.com
AUTH0_AUDIENCE=https://<auth0-api-identifier>
AUTH0_ROLE_CLAIM=https://deeptrack.io/roles
AUTH0_COMPANY_ID_CLAIM=https://deeptrack.io/company_id
DATA_ROOM_ORIGIN=https://<approved-data-room-domain>
DATA_ROOM_S3_BUCKET=<private-bucket-name>
DATABASE_URL=<protected PostgreSQL connection string>
DATABASE_SSL=true
DATA_ROOM_MAX_FILE_BYTES=26214400
```

### 6.3 Data-room frontend build configuration

After API deployment, build the frontend with:

```text
VITE_DATA_ROOM_API_BASE_URL=https://<api-id>.execute-api.<aws-region>.amazonaws.com
```

The value must be present at build time. Rebuilding without it can cause the frontend to use the local review adapter rather than the authenticated production API.

## 7. Deployment sequence

Vontech should execute the following order:

1. Confirm the AWS account, region, naming conventions, IAM ownership, and protected secret workflow.
2. Deploy the SageMaker model artifact and endpoint.
3. Confirm SageMaker invocation from the approved application role using non-sensitive test media.
4. Provision PostgreSQL/RDS and apply the reviewed schema.
5. Provision the private S3 bucket and validate public access is blocked.
6. Deploy API Gateway and Lambda using the SAM template and protected database configuration.
7. Call `/health` and verify database/model readiness.
8. Run authenticated API acceptance tests with valid and invalid Auth0 tokens.
9. Build the data-room frontend with the real API Gateway URL.
10. Upload the static artifact to S3 and attach it to CloudFront.
11. Confirm the CloudFront alternate domain and ACM certificate.
12. Invalidate CloudFront cache and verify the custom domain over HTTPS.
13. Run the complete production acceptance suite.
14. Record deployment identifiers, rollback artifacts, alarms, owners, and incident contacts.

The data-room repository includes an AWS migration runbook and SAM template. The standard software validation commands are:

```bash
# Gotham
npm ci
npm run build
npm run lint

# Data room frontend
npm ci
npm run build

# Data room backend
cd backend
npm ci
npm run typecheck
npm run build

# AWS packaging and deployment, owned by Vontech
sam build --template-file template.yaml
sam deploy --guided --template-file .aws-sam/build/template.yaml
```

Do not put database passwords, Auth0 client secrets, AWS access keys, or tokens in committed files or shell history.

## 8. Production acceptance checklist

### Gotham model and API

| Test | Expected result |
|---|---|
| Missing SageMaker endpoint | HTTP `503`; no credit charge |
| Valid authentic media | `AUTHENTIC` result with model name/version |
| Valid manipulated media | `DEEPFAKE` result with normalized score |
| Ambiguous media | `SUSPICIOUS` result |
| Malformed model JSON | Safe error; no raw provider exception exposed |
| SageMaker timeout | Safe error; charged credit refunded |
| Model endpoint unavailable | Safe error; no third-party detector invoked |
| Oversized or unsupported media | Rejected before model invocation |
| Health endpoint without model configuration | HTTP `503`, no secrets exposed |
| Wrong Auth0 issuer/audience | Request rejected |
| Cross-customer access attempt | Request rejected |

### Data room

| Test | Pass condition |
|---|---|
| Auth0 issuer and audience | Valid JWT accepted; wrong issuer/audience rejected |
| Role enforcement | Founder and Investor Relations can administer; Investor is read-only |
| Clearance enforcement | Investor cannot list or download documents above assigned tier |
| NDA enforcement | Investor without current NDA acknowledgement receives no document URL |
| Invitation expiry | Expired or revoked grants cannot access the room |
| Private storage | Direct unauthorized S3 access fails |
| Upload intent | Short-lived, owner-bound, size/content checked, single-use |
| Download URL | Short-lived, object-scoped, issued only after authorization |
| Audit trail | Login, denial, NDA, view, upload, publication, download, and access changes are recorded |
| Tenant isolation | Browser parameter changes cannot reveal another firm’s documents |
| Version history | New uploads preserve prior versions |
| Logging | No secrets, tokens, identity documents, or raw provider exceptions logged |
| Recovery | Previous frontend/API artifacts and database backups are available |

## 9. Ownership boundary

| Workstream | Deeptrack engineering | Vontech |
|---|---|---|
| Gotham frontend and API code | Completed and merged | Deploy and operate |
| SageMaker adapter and response normalization | Completed | Provide endpoint and model contract |
| SageMaker model artifact and endpoint | Define contract and test | Provision, secure, monitor, and scale |
| MongoDB-to-PostgreSQL application migration | Implement repository and migration code | Provision database and operational controls |
| PostgreSQL runtime | Application schema/future repository | RDS, VPC, TLS, backups, credentials, capacity |
| Data-room API code | Implemented | Deploy Lambda/API Gateway and configure runtime |
| Data-room S3 adapter | Implemented | Provision bucket, IAM, encryption, policy, lifecycle |
| CloudFront/ACM/DNS | Specify required configuration | Configure distribution, certificate, aliases, cache, and DNS |
| Auth0 application logic | Implemented | Confirm tenant settings, URLs, claims, and secrets |
| Monitoring and incident response | Define events and health signals | Configure CloudWatch, alarms, on-call, and recovery |
| Production acceptance | Support test design and remediation | Execute AWS-side tests and provide evidence |

## 10. Immediate handover actions for Vontech

Vontech should begin with the following information exchange:

1. AWS account and region where Gotham and the data room will run.
2. SageMaker endpoint name, ARN, region, model version, and response contract.
3. Model artifact S3 URI and the intended SageMaker execution role.
4. PostgreSQL/RDS endpoint strategy, database name, TLS policy, and secret-management method.
5. S3 bucket names, CloudFront distribution ID, and ACM certificate ARN.
6. API Gateway URL after SAM deployment.
7. Auth0 production tenant/application values and confirmed role/company claims.
8. CloudWatch log groups, alarms, retention, and incident owner.
9. Results of the production acceptance checklist.

Once the above values are supplied, Deeptrack engineering can complete the live SageMaker validation, finalize the PostgreSQL runtime migration, and assist with any deployment defects without changing the application architecture again.

## References

1. `docs/GOTHAM_AWS_MODEL_CONTRACT.md` — Gotham proprietary AWS model request, response, timeout, failure, and acceptance contract.
2. `docs/AWS_MIGRATION_RUNBOOK.md` in `deeptrack-data-room` — data-room AWS architecture, environment configuration, deployment sequence, and production acceptance checklist.
3. `db/postgres/001_initial.sql` in `Gotham-Enterprise` — initial Gotham PostgreSQL schema foundation.
4. `app/api/scans/route.ts` and `lib/gothamModel.ts` in `Gotham-Enterprise` — proprietary model enforcement and defensive inference adapter.
5. Pull request #2, `deeptrck/Gotham-Enterprise` — final CodeRabbit-reviewed and merged software changes: https://github.com/deeptrck/Gotham-Enterprise/pull/2

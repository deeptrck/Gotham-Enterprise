# Gotham AWS Cutover Handoff

**Release commit:** `965d922f3a9d07a2f78f35952d166dac682861eb`
**Repository:** `https://github.com/deeptrck/Gotham-Enterprise`
**Branch:** `main`
**Owner:** Kamau / John, DevOps

## Release status

This release contains the validated Gotham engineering changes for the AWS cutover. It includes PostgreSQL repository access, mandatory Auth0 organization scope, fail-closed RBAC middleware, SageMaker-only model execution, transactional credit accounting, idempotent model invocations, migration normalization helpers, and Auth0/RBAC and migration integration tests.

The commit is pushed to GitHub. No AWS infrastructure was changed by engineering.

## Validation evidence

| Check | Result |
|---|---|
| `npm audit --omit=dev --audit-level=high` | Passed; 0 vulnerabilities |
| Gitleaks | Passed; no leaks found |
| `npm run test:integration` | Passed: 7 tests; PostgreSQL test skipped because no `DATABASE_URL` was configured in the engineering sandbox |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed with two existing non-blocking `<img>` optimization warnings |
| `npm run build` | Passed on Next.js `16.3.3` |
| Legacy detector audit | No Reality Defender, FakeCatcher, legacy backend, or legacy fallback execution references remain in `app`, `lib`, or `package.json` |

## Required AWS configuration

Configure these values in the AWS runtime secret store, never in the repository or image:

```text
DATABASE_URL
DIRECT_URL                  # if the deployment uses a separate direct PostgreSQL URL
AUTH0_SECRET
AUTH0_DOMAIN
AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET         # only where server-side Auth0 SDK configuration requires it
AUTH0_AUDIENCE
AUTH0_ORGANIZATION_ID       # if used by the deployment configuration
SAGEMAKER_REGION
SAGEMAKER_ENDPOINT_NAME
GOTHAM_MODEL_NAME
GOTHAM_MODEL_VERSION
AWS_REGION
```

The Auth0 token must contain the namespaced claims `https://deeptrack.io/roles` and an organization claim accepted by Gotham: `org_id`, `organization_id`, or `https://deeptrack.io/organization_id`. Users must have active rows in `organization_memberships` before they can access tenant-scoped APIs.

## PostgreSQL migration order

1. Create or select the approved production RDS PostgreSQL database and take a backup before schema changes.
2. Apply `db/postgres/001_initial.sql`.
3. Apply `db/postgres/002_enterprise_operational.sql`.
4. From a controlled migration runner, configure the approved MongoDB and PostgreSQL test connection strings and run the default dry run:

```bash
node scripts/migrate-mongo-to-postgres.js
```

5. Review source counts, target counts, deterministic legacy-ID mappings, normalized statuses/file types, and duplicate handling. Do not use `--apply` until reconciliation is signed off.
6. Run the optional live tenant test after the schema is applied:

```bash
DATABASE_URL='postgresql://...' npm run test:postgres
```

7. Only after approval, execute the migration with `--apply` from a restricted, audited runner. MongoDB remains read-only; the utility does not drop collections.

## AWS deployment sequence

Build the image from the release commit, deploy it to the staging ECS/Lambda target, and attach the RDS secret and SageMaker execution role. The SageMaker execution role must permit only invocation of the approved Gotham endpoint. It must not include permissions for third-party detection services.

Run staging smoke tests for login, missing-organization denial, role denial, cross-tenant result access, image scan, video scan, repeated `Idempotency-Key` requests, insufficient credits, and model timeout/refund behavior. Confirm that the API returns `401` for unauthenticated requests and `403` when Auth0 organization context is absent.

After staging verification, deploy to production behind the existing CloudFront/API entry point. Monitor application errors, SageMaker invocation status, PostgreSQL connection pool saturation, credit-ledger duplicates, and Auth0 callback failures during the first release window.

## Rollback

If the health checks fail, route traffic back to the previous image or Lambda version built from the preceding known-good commit. Do not roll back the PostgreSQL schema by dropping columns or tables. Keep the additive migration in place, preserve model-invocation and usage-event records, and investigate the application version or configuration issue. Restore from the pre-cutover RDS backup only if a database integrity issue is confirmed.

## Current blocker

Engineering could not execute the live MongoDB-to-PostgreSQL dry run because the sandbox did not contain `MONGODB_URI`, `MONGODB_DATABASE`, or `DATABASE_URL`. DevOps must run the dry run with approved test-only connection strings and attach the resulting reconciliation output to the release record before production data migration.

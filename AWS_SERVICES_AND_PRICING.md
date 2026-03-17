# AWS Services Reference — Gotham Platform

This doc lists every AWS service you need, what it does in this project, which environments it lives in, and the exact inputs to enter into the AWS Pricing Calculator at https://calculator.aws

---

## Quick Service Map

| AWS Service | What it does in this project | Shared or per-env |
|---|---|---|
| App Runner | Runs Next.js app container | Per environment |
| App Runner | Runs FakeCatcher Python API container | Per environment |
| ECR | Stores Docker images for both apps | Shared (all envs) |
| ElastiCache (Redis) | Stores video job state, BullMQ queue | Per environment |
| Secrets Manager | Stores all env vars / API keys | Per environment |
| Route 53 | DNS + domain routing | Shared (all envs) |
| ACM | SSL certificates (auto-provisioned by App Runner) | Per environment |
| IAM | GitHub Actions OIDC role, App Runner execution role | Shared |
| ECS Fargate | BullMQ scan worker (prod only, when RD re-enabled) | Prod only |
| CloudWatch | Logs from App Runner + ECS | Per environment |

---

## Service Details

---

### 1. AWS App Runner — Next.js

Runs the containerized Next.js app. Handles all web traffic, SSR, and API routes including `/api/scans`, `/api/paystack/*`, `/api/users/*`.

**Why App Runner and not ECS or Lambda:**
- No VPC, load balancer, or cluster config needed
- Auto-scales to zero when idle
- HTTPS + custom domain built in
- Handles long-running requests (video scans up to 90s) — Lambda can't

**Configuration per environment:**

| Setting | Dev | Staging (Option B) | Prod |
|---|---|---|---|
| CPU | 0.25 vCPU | 1 vCPU | 1 vCPU |
| Memory | 0.5 GB | 2 GB | 2 GB |
| Min instances | 1 | 1 | 1 |
| Max instances | 1 | 3 | 5 |
| Port | 3000 | 3000 | 3000 |
| Health check path | `/` | `/` | `/` |

**Pricing Calculator inputs (per environment):**
- Service: `AWS App Runner`
- vCPU: as above
- Memory: as above
- Avg requests/month: your estimate
- Avg request duration: `200ms` for pages, `5000ms` for scan API calls
- Provisioned concurrency: `0` (scale to zero when idle)

---

### 2. AWS App Runner — FakeCatcher

Runs the Python deepfake detection API. Receives image/video uploads from the Next.js app and returns predictions.

**Configuration per environment:**

| Setting | Dev | Staging (Option B) | Prod |
|---|---|---|---|
| CPU | 0.5 vCPU | 1 vCPU | 1 vCPU |
| Memory | 1 GB | 2 GB | 2 GB |
| Min instances | 1 | 1 | 1 |
| Max instances | 1 | 2 | 3 |
| Port | 8000 | 8000 | 8000 |
| Health check path | `/health` | `/health` | `/health` |

**Pricing Calculator inputs (per environment):**
- Service: `AWS App Runner`
- vCPU: as above
- Memory: as above
- Avg requests/month: same as scan volume (1 request per scan)
- Avg request duration: `2000ms` for images, `30000ms` for videos

---

### 3. Amazon ECR — Elastic Container Registry

Stores Docker images for both apps. Shared across all environments — images are tagged by environment and git SHA (`dev-abc123`, `prod-abc123`).

**Repositories needed:**
- `gotham-enterprise` — Next.js app images
- `fakecatcher` — Python API images

**Lifecycle policy (recommended):** Keep last 10 images per tag prefix, delete untagged images after 1 day. This keeps storage costs near zero.

**Pricing Calculator inputs:**
- Service: `Amazon ECR`
- Storage: `2 GB` (two images, ~1 GB each)
- Data transfer out: negligible (App Runner pulls from ECR within same region — free)

**Estimated cost: < $1/month**

---

### 4. Amazon ElastiCache — Redis

Used for two things:
1. **Video job state** — replaces the in-memory `fakecatcherStore.ts` Maps. Stores job metadata and FakeCatcher analysis results with a 2-hour TTL
2. **BullMQ queue** — when the scan worker is re-enabled, BullMQ uses Redis as its job queue

One Redis cluster per environment. App Runner connects via VPC connector.

**Configuration per environment:**

| Setting | Dev | Staging (Option B) | Prod |
|---|---|---|---|
| Engine | Redis 7.x | Redis 7.x | Redis 7.x |
| Node type | `cache.t4g.micro` | `cache.t4g.micro` | `cache.t4g.small` |
| Nodes | 1 | 1 | 1 |
| Multi-AZ | No | No | Optional |
| Cluster mode | Disabled | Disabled | Disabled |

**Pricing Calculator inputs (per environment):**
- Service: `Amazon ElastiCache`
- Engine: `Redis`
- Node type: as above
- Number of nodes: `1`
- Hours per month: `730` (24/7)

**Estimated cost:**
- `cache.t4g.micro` — ~$12/month
- `cache.t4g.small` — ~$25/month

---

### 5. AWS Secrets Manager

Stores all environment variables and API keys. App Runner pulls secrets at startup via an IAM execution role. No secrets are hardcoded in Docker images or GitHub Actions.

**Secret structure:**

```
gotham/dev/nextjs          ← all Next.js env vars for dev
gotham/dev/fakecatcher     ← FakeCatcher env vars for dev
gotham/prod/nextjs         ← all Next.js env vars for prod
gotham/prod/fakecatcher    ← FakeCatcher env vars for prod
gotham/staging/nextjs      ← (Option B only)
gotham/staging/fakecatcher ← (Option B only)
```

**What goes in each secret:**

`gotham/<env>/nextjs`:
- `MONGODB_URI`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_CALLBACK_URL`
- `BACKEND_API_URL` (points to FakeCatcher App Runner URL for that env)
- `BACKEND_REQUEST_TIMEOUT_MS`
- `REDIS_HOST`
- `REDIS_PORT`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`

`gotham/<env>/fakecatcher`:
- Any API keys or config the Python API needs

**Pricing Calculator inputs:**
- Service: `AWS Secrets Manager`
- Number of secrets: `4` (Option A) or `6` (Option B)
- API calls/month: ~`10,000` (App Runner reads secrets on startup + rotation checks)

**Estimated cost: ~$2–3/month**

---

### 6. Amazon Route 53

DNS hosting and domain routing. One hosted zone for your domain, with records pointing subdomains to the right App Runner service per environment.

**Records needed:**

Option A:
```
yourdomain.com         → CNAME → prod App Runner URL
dev.yourdomain.com     → CNAME → dev App Runner URL
```

Option B (add):
```
staging.yourdomain.com → CNAME → staging App Runner URL
```

**Pricing Calculator inputs:**
- Service: `Amazon Route 53`
- Hosted zones: `1`
- DNS queries/month: estimate based on traffic (start with `1,000,000`)

**Estimated cost: ~$0.50–1/month**

---

### 7. AWS Certificate Manager (ACM)

SSL/TLS certificates for your custom domains. App Runner provisions these automatically when you add a custom domain — no manual setup needed. ACM certificates are free.

**Cost: $0**

---

### 8. AWS IAM

Two roles needed:

**GitHub Actions OIDC Role**
- Allows GitHub Actions to authenticate to AWS without storing long-lived access keys
- Permissions: `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, `apprunner:StartDeployment`
- Trust policy: GitHub's OIDC provider (`token.actions.githubusercontent.com`)

**App Runner Execution Role**
- Allows App Runner to pull images from ECR and read secrets from Secrets Manager
- Permissions: `ecr:GetDownloadUrlForLayer`, `secretsmanager:GetSecretValue`

**Cost: $0** (IAM is free)

---

### 9. Amazon CloudWatch

App Runner automatically sends container logs to CloudWatch. Useful for debugging scan failures, payment webhook errors, and access logs.

**Log groups created automatically:**
- `/aws/apprunner/gotham-enterprise-<env>/application`
- `/aws/apprunner/fakecatcher-<env>/application`

**Pricing Calculator inputs:**
- Service: `Amazon CloudWatch`
- Log ingestion: `5 GB/month` (estimate)
- Log storage: `30 day retention`

**Estimated cost: ~$2–5/month**

---

### 10. AWS ECS Fargate — BullMQ Scan Worker

**Status: Not needed yet — only required when Reality Defender is re-enabled.**

The `dist-workers/workers/scanWorker.js` is a long-running BullMQ process that can't run inside App Runner. It runs as a persistent ECS Fargate task in prod only.

**Configuration (when needed):**

| Setting | Value |
|---|---|
| CPU | 0.25 vCPU |
| Memory | 0.5 GB |
| Tasks | 1 (always running) |
| Environment | Prod only |

**Pricing Calculator inputs (when needed):**
- Service: `AWS Fargate`
- OS: `Linux`
- CPU: `0.25 vCPU`
- Memory: `0.5 GB`
- Tasks: `1`
- Duration: `730 hours/month` (24/7)

**Estimated cost: ~$10/month**

---

## Services NOT on AWS (stay external)

| Service | Provider | Why it stays external |
|---|---|---|
| MongoDB | MongoDB Atlas | Managed, free M0 tier, no AWS equivalent at this price point for early stage |
| Authentication | Clerk | Handles auth UI, session management, JWTs — no AWS Cognito migration needed |
| Payments | Paystack | Payment processor, not replaceable with AWS |
| Error monitoring | Sentry | Error tracking + source maps, stays on Sentry Cloud |

---

## Full AWS Pricing Calculator — What to Add

Go to https://calculator.aws → Create estimate → Add the following services:

```
1. AWS App Runner          ← Next.js (add once per environment)
2. AWS App Runner          ← FakeCatcher (add once per environment)
3. Amazon ECR              ← shared, add once
4. Amazon ElastiCache      ← Redis (add once per environment)
5. AWS Secrets Manager     ← add once, enter total secret count
6. Amazon Route 53         ← add once
7. Amazon CloudWatch       ← add once, covers all environments
8. AWS Fargate             ← add only if BullMQ worker is active
```

---

## Cost Summary by Environment

### Option A — Dev + Prod

| Service | Dev | Prod | Total |
|---|---|---|---|
| App Runner (Next.js) | ~$5 | ~$30–60 | |
| App Runner (FakeCatcher) | ~$5 | ~$25–50 | |
| ElastiCache Redis | ~$12 | ~$25 | |
| Secrets Manager | ~$1 | ~$1 | |
| ECR | — | ~$1 | |
| Route 53 | — | ~$1 | |
| CloudWatch | ~$1 | ~$3 | |
| **AWS Total** | **~$24** | **~$86–141** | **~$110–165/mo** |
| MongoDB Atlas | free (M0) | free–$57 (M10) | |
| Clerk | free | free–$25 (Pro) | |
| Sentry | free | free–$26 (Team) | |
| **Grand Total** | | | **~$110–273/mo** |

### Option B — Dev + Staging + Prod (add to Option A)

| Staging additions | Cost |
|---|---|
| App Runner (Next.js) | ~$20 |
| App Runner (FakeCatcher) | ~$20 |
| ElastiCache Redis | ~$12 |
| Secrets Manager | ~$1 |
| **Staging subtotal** | **~$53/mo extra** |

> Pause dev and staging App Runner services outside business hours (8am–6pm weekdays) to reduce those environment costs by ~60%.

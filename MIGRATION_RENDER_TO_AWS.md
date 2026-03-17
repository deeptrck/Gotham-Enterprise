# Render → AWS Migration Guide

## Overview

Two GitHub repositories, three environments, one AWS account:

```
github.com/you/gotham-enterprise     ← Next.js app
github.com/you/fakecatcher           ← Python deepfake API
github.com/you/gotham-infra          ← Terraform (manages all AWS infra)
```

Flow on every merge to `main` / `staging` / `dev`:
```
App repo pushes code
  → GitHub Actions builds Docker image
  → pushes to ECR
  → triggers workflow in gotham-infra
    → Terraform applies updated image tag to App Runner
```

---

## Environment Strategy

Two options — decide with the client which fits their team and budget.

---

### Option A — Dev + Prod (recommended for early stage)

| Environment | Branch | AWS Resources | Domain |
|---|---|---|---|
| dev | `dev` | Small instances, single Redis node | `dev.yourdomain.com` |
| prod | `main` | Full sizing, auto-scaling enabled | `yourdomain.com` |

**When to choose this:**
- Early stage, small team, no dedicated QA
- Want to move fast and keep costs low
- Bad prod deploys are recoverable (you can roll back via ECR image tag)

**Monthly AWS cost:** ~$23/mo (dev) + ~$84–139/mo (prod) = **~$107–162/mo**

---

### Option B — Dev + Staging + Prod

| Environment | Branch | AWS Resources | Domain |
|---|---|---|---|
| dev | `dev` | Small instances, single Redis node | `dev.yourdomain.com` |
| staging | `staging` | Mirrors prod sizing, used for QA | `staging.yourdomain.com` |
| prod | `main` | Full sizing, auto-scaling enabled | `yourdomain.com` |

**When to choose this:**
- Client has a QA team or sign-off process before prod
- High prod traffic where a bad deploy is a serious incident
- Automated test suites that run against a live environment

**Monthly AWS cost:** ~$23/mo (dev) + ~$53/mo (staging) + ~$84–139/mo (prod) = **~$160–215/mo**

> Staging cost can be reduced ~60% by pausing App Runner services outside business hours.

---

**The Terraform module structure supports both options.** Adding staging later is just adding an `environments/staging/` folder — no module changes needed.

---

Each environment gets its own:
- App Runner services (Next.js + FakeCatcher)
- ElastiCache Redis cluster
- Secrets Manager secrets (`gotham/dev/*`, `gotham/staging/*`, `gotham/prod/*`)
- ECR image tags (`image:dev-<sha>`, `image:staging-<sha>`, `image:prod-<sha>`)

MongoDB Atlas, Clerk, Paystack, and Sentry stay external — create separate projects/keys per environment in each of those platforms.

---

## AWS Architecture Diagram

### Option A — Dev + Prod

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          AWS Account (us-east-1)                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        ECR (shared)                              │   │
│  │  gotham-enterprise:dev-<sha>   prod-<sha>                        │   │
│  │  fakecatcher:dev-<sha>         prod-<sha>                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────┐      ┌──────────────────────────┐        │
│  │   DEV                    │      │   PROD                   │        │
│  │                          │      │                          │        │
│  │  App Runner (Next.js)    │      │  App Runner (Next.js)    │        │
│  │  0.25vCPU / 0.5GB        │      │  1vCPU / 2GB             │        │
│  │                          │      │  min:1  max:5            │        │
│  │  App Runner (FakeCatcher)│      │                          │        │
│  │  0.5vCPU / 1GB           │      │  App Runner (FakeCatcher)│        │
│  │                          │      │  1vCPU / 2GB             │        │
│  │  ElastiCache             │      │  min:1  max:3            │        │
│  │  cache.t4g.micro         │      │                          │        │
│  │                          │      │  ElastiCache             │        │
│  │  Secrets Manager         │      │  cache.t4g.small         │        │
│  │  gotham/dev/*            │      │                          │        │
│  └──────────────────────────┘      │  Secrets Manager         │        │
│                                    │  gotham/prod/*           │        │
│                                    └──────────────────────────┘        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Route 53 (shared)                                               │   │
│  │  dev.yourdomain.com → dev App Runner                             │   │
│  │  yourdomain.com     → prod App Runner                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ECS Fargate (prod only — when BullMQ worker re-enabled)         │   │
│  │  scanWorker → prod ElastiCache + MongoDB                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

              EXTERNAL SERVICES (separate keys per env)
       MongoDB Atlas · Clerk · Paystack · Sentry
```

### Option B — Dev + Staging + Prod

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          AWS Account (us-east-1)                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        ECR (shared)                              │   │
│  │  gotham-enterprise:dev-<sha>  staging-<sha>  prod-<sha>          │   │
│  │  fakecatcher:dev-<sha>        staging-<sha>  prod-<sha>          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐     │
│  │   DEV          │  │   STAGING      │  │   PROD               │     │
│  │                │  │                │  │                      │     │
│  │  App Runner    │  │  App Runner    │  │  App Runner          │     │
│  │  (Next.js)     │  │  (Next.js)     │  │  (Next.js)           │     │
│  │  0.25vCPU/0.5GB│  │  1vCPU/2GB    │  │  1vCPU/2GB           │     │
│  │                │  │                │  │  min:1 max:5         │     │
│  │  App Runner    │  │  App Runner    │  │                      │     │
│  │  (FakeCatcher) │  │  (FakeCatcher) │  │  App Runner          │     │
│  │  0.5vCPU/1GB   │  │  1vCPU/2GB    │  │  (FakeCatcher)       │     │
│  │                │  │                │  │  1vCPU/2GB           │     │
│  │  ElastiCache   │  │  ElastiCache   │  │  min:1 max:3         │     │
│  │  t4g.micro     │  │  t4g.micro     │  │                      │     │
│  │                │  │                │  │  ElastiCache         │     │
│  │  Secrets Mgr   │  │  Secrets Mgr   │  │  t4g.small           │     │
│  │  gotham/dev/*  │  │  gotham/stg/*  │  │                      │     │
│  └────────────────┘  └────────────────┘  │  Secrets Manager     │     │
│                                           │  gotham/prod/*       │     │
│                                           └──────────────────────┘     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Route 53 (shared)                                               │   │
│  │  dev.yourdomain.com     → dev App Runner                         │   │
│  │  staging.yourdomain.com → staging App Runner                     │   │
│  │  yourdomain.com         → prod App Runner                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ECS Fargate (prod only — when BullMQ worker re-enabled)         │   │
│  │  scanWorker → prod ElastiCache + MongoDB                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

              EXTERNAL SERVICES (separate keys per env)
       MongoDB Atlas · Clerk · Paystack · Sentry
```

---

## Terraform Infra Repo Structure

```
gotham-infra/
├── modules/
│   ├── app-runner/          # reusable App Runner service module
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── elasticache/         # reusable Redis cluster module
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── secrets/             # reusable Secrets Manager module
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
│
├── environments/
│   ├── dev/
│   │   ├── main.tf          # calls modules with dev sizing
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/             # Option B only — add this folder if 3 envs chosen
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   └── prod/
│       ├── main.tf
│       ├── variables.tf
│       └── terraform.tfvars
│
├── global/
│   ├── ecr.tf               # ECR repos (shared across envs)
│   ├── route53.tf           # hosted zone (shared)
│   └── iam.tf               # GitHub Actions OIDC role
│
└── .github/
    └── workflows/
        ├── deploy-dev.yml
        ├── deploy-staging.yml   # Option B only
        └── deploy-prod.yml
```

> Start with just `environments/dev/` and `environments/prod/`. Add `environments/staging/` later if Option B is chosen — no module changes needed.

Each `environments/<env>/main.tf` calls the shared modules with different sizing:

```hcl
# environments/prod/main.tf
module "nextjs" {
  source        = "../../modules/app-runner"
  name          = "gotham-enterprise-prod"
  image_uri     = var.nextjs_image_uri   # passed in from GitHub Actions
  cpu           = "1024"
  memory        = "2048"
  min_size      = 1
  max_size      = 5
  env_secrets   = "arn:aws:secretsmanager:...:gotham/prod/nextjs"
}

module "fakecatcher" {
  source        = "../../modules/app-runner"
  name          = "fakecatcher-prod"
  image_uri     = var.fakecatcher_image_uri
  cpu           = "1024"
  memory        = "2048"
  min_size      = 1
  max_size      = 3
  env_secrets   = "arn:aws:secretsmanager:...:gotham/prod/fakecatcher"
}

module "redis" {
  source      = "../../modules/elasticache"
  name        = "gotham-prod"
  node_type   = "cache.t4g.small"
}
```

---

## GitHub Actions — Cross-Repo Deploy Flow

### App Repo Workflow (gotham-enterprise)

```
.github/workflows/deploy.yml
```

Triggers on push to `dev`, `staging`, or `main`. Builds image, pushes to ECR, then calls the infra repo via `repository_dispatch`.

```yaml
name: Build & Deploy

on:
  push:
    branches: [main, staging, dev]

jobs:
  build-and-trigger:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set environment name
        id: env
        run: |
          if [ "${{ github.ref_name }}" = "main" ]; then
            echo "name=prod" >> $GITHUB_OUTPUT
          elif [ "${{ github.ref_name }}" = "staging" ]; then
            echo "name=staging" >> $GITHUB_OUTPUT
          else
            echo "name=dev" >> $GITHUB_OUTPUT
          fi

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_OIDC_ROLE_ARN }}
          aws-region: us-east-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push image
        id: build
        run: |
          IMAGE_TAG=${{ steps.env.outputs.name }}-${{ github.sha }}
          IMAGE_URI=${{ secrets.ECR_REGISTRY }}/gotham-enterprise:$IMAGE_TAG
          docker build -t $IMAGE_URI .
          docker push $IMAGE_URI
          echo "image_uri=$IMAGE_URI" >> $GITHUB_OUTPUT

      - name: Trigger infra repo deploy
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.INFRA_REPO_TOKEN }}
          repository: your-org/gotham-infra
          event-type: deploy-nextjs
          client-payload: |
            {
              "environment": "${{ steps.env.outputs.name }}",
              "image_uri": "${{ steps.build.outputs.image_uri }}"
            }
```

### Infra Repo Workflow (gotham-infra)

```
.github/workflows/deploy-on-trigger.yml
```

Receives the dispatch event, runs `terraform apply` for the right environment with the new image URI.

```yaml
name: Terraform Deploy

on:
  repository_dispatch:
    types: [deploy-nextjs, deploy-fakecatcher]

jobs:
  terraform:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_OIDC_ROLE_ARN }}
          aws-region: us-east-1

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Terraform Init
        working-directory: environments/${{ github.event.client_payload.environment }}
        run: terraform init

      - name: Terraform Apply
        working-directory: environments/${{ github.event.client_payload.environment }}
        run: |
          terraform apply -auto-approve \
            -var="nextjs_image_uri=${{ github.event.client_payload.image_uri }}"
```

---

## What You Need to Fix Before Deployment

### 1. `lib/fakecatcherStore.ts` — Critical

In-memory Maps break on any multi-instance environment. App Runner runs multiple instances. Video job polling will silently fail.

Replace with ElastiCache Redis before deploying:
```ts
// Before:  jobMetaStore.set(jobId, meta)
// After:   await redis.set(`job:meta:${jobId}`, JSON.stringify(meta), 'EX', 7200)

// Before:  jobMetaStore.get(jobId)
// After:   JSON.parse(await redis.get(`job:meta:${jobId}`) ?? 'null')
```

### 2. `next.config.ts` — Required for Docker

Add standalone output or the Docker image won't build correctly:
```ts
const nextConfig: NextConfig = {
  output: "standalone",
  // ...existing config
}
```

### 3. `next.config.ts` — Remove Vercel-specific config

The `automaticVercelMonitors: true` in the Sentry webpack config is Vercel-only. Remove it:
```ts
webpack: {
  treeshake: {
    removeDebugLogging: true,
  },
  // remove: automaticVercelMonitors: true
}
```

### 4. Environment Variables — `NEXT_PUBLIC_*` at build time

`NEXT_PUBLIC_*` variables are baked into the client bundle at `next build` time, not at runtime. This means your Docker image needs them passed as build args, not just runtime env vars.

In your Dockerfile:
```dockerfile
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
RUN npm run build
```

In GitHub Actions, pass them at build time:
```yaml
- name: Build image
  run: |
    docker build \
      --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }} \
      --build-arg NEXT_PUBLIC_SENTRY_DSN=${{ secrets.NEXT_PUBLIC_SENTRY_DSN }} \
      -t $IMAGE_URI .
```

This means you need **separate images per environment** (which the `dev-<sha>` / `staging-<sha>` / `prod-<sha>` tag strategy already handles).

### 5. Paystack Webhook URL — per environment

Update in Paystack dashboard for each environment:
- dev: `https://dev.yourdomain.com/api/paystack/webhook`
- staging: `https://staging.yourdomain.com/api/paystack/webhook`
- prod: `https://yourdomain.com/api/paystack/webhook`

### 6. Clerk — Allowed Origins per environment

In Clerk dashboard, add all three domains to allowed origins and redirect URLs.

---

## Pricing Estimate

Use [calculator.aws](https://calculator.aws) — add: App Runner, ElastiCache, ECR, Route 53, Secrets Manager.

### Per Environment AWS Cost

| Service | Dev | Staging (Option B) | Prod |
|---|---|---|---|
| App Runner (Next.js) | ~$5/mo | ~$20/mo | ~$30–60/mo |
| App Runner (FakeCatcher) | ~$5/mo | ~$20/mo | ~$25–50/mo |
| ElastiCache Redis | ~$12/mo | ~$12/mo | ~$25/mo |
| Secrets Manager | ~$1/mo | ~$1/mo | ~$2/mo |
| ECR (shared) | — | — | ~$1/mo |
| Route 53 (shared) | — | — | ~$1/mo |
| **Environment subtotal** | **~$23/mo** | **~$53/mo** | **~$84–139/mo** |

### Option A — Dev + Prod

| Scenario | AWS | External Services | Total |
|---|---|---|---|
| Early stage | ~$107/mo | Clerk free + MongoDB M0 free + Sentry free | **~$107/mo** |
| Production | ~$107/mo | Clerk Pro $25 + MongoDB M10 $57 + Sentry Team $26 | **~$215/mo** |

### Option B — Dev + Staging + Prod

| Scenario | AWS | External Services | Total |
|---|---|---|---|
| Early stage | ~$160/mo | Clerk free + MongoDB M0 free + Sentry free | **~$160/mo** |
| Production | ~$160/mo | Clerk Pro $25 + MongoDB M10 $57 + Sentry Team $26 | **~$268/mo** |

> Dev and staging App Runner services can be paused outside business hours to cut those environment costs by ~60%.

---

## Checklist — Before You Write Any Terraform

**Decide with client first:**
- [ ] Confirm environment strategy — Option A (dev + prod) or Option B (dev + staging + prod)

**Code fixes (both options):**
- [ ] Fix `fakecatcherStore.ts` — replace Maps with Redis
- [ ] Add `output: "standalone"` to `next.config.ts`
- [ ] Remove `automaticVercelMonitors` from `next.config.ts`
- [ ] Handle `NEXT_PUBLIC_*` vars as Docker build args

**AWS setup (both options):**
- [ ] Create AWS account + enable billing alerts
- [ ] Set up GitHub OIDC role in AWS IAM (avoids storing AWS keys in GitHub secrets)
- [ ] Create ECR repos (`gotham-enterprise`, `fakecatcher`) — do this first, Terraform references them
- [ ] Clone / scaffold `gotham-infra` repo locally with folder structure above

**External services — Option A (dev + prod):**
- [ ] Create separate Clerk apps for dev and prod
- [ ] Create separate MongoDB Atlas projects for dev and prod
- [ ] Create separate Paystack webhook endpoints for dev and prod
- [ ] Store secrets in Secrets Manager under `gotham/dev/*` and `gotham/prod/*`

**External services — Option B (add staging on top of A):**
- [ ] Create Clerk app for staging
- [ ] Create MongoDB Atlas project for staging
- [ ] Create Paystack webhook endpoint for staging
- [ ] Store secrets in Secrets Manager under `gotham/staging/*`

**Terraform + CI/CD (both options):**
- [ ] Write Terraform modules (app-runner, elasticache, secrets)
- [ ] Write environment configs — `environments/dev/` and `environments/prod/` (add `environments/staging/` if Option B)
- [ ] Write GitHub Actions workflows in both app repos and infra repo
- [ ] Test full deploy pipeline on dev first
- [ ] (When RD re-enabled) Add ECS Fargate task for BullMQ worker in prod Terraform config

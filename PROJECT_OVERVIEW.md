# Gotham Enterprise — Project Overview

## What It Is

Gotham Enterprise is a **media authenticity verification SaaS dashboard**. Users upload images or videos, the platform runs them through deepfake detection models, and returns a verdict (AUTHENTIC / SUSPICIOUS / DEEPFAKE) with a confidence score. It is built for enterprise teams that need high-volume, auditable media analysis.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│         Next.js App Router  ·  React 19  ·  Tailwind CSS        │
│         Clerk UI Components  ·  Recharts  ·  shadcn/ui          │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────────┐
│                  NEXT.JS SERVER (Vercel / Node)                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Middleware  │  │  App Router  │  │     API Routes         │ │
│  │  (Clerk +    │  │  Pages       │  │  /api/scans            │ │
│  │  Access Log) │  │  /dashboard  │  │  /api/results/[id]     │ │
│  └──────────────┘  │  /history    │  │  /api/users/sync       │ │
│                    │  /pricing    │  │  /api/users/dashboard  │ │
│                    │  /results    │  │  /api/paystack/*       │ │
│                    │  /admin      │  │  /api/bugs             │ │
│                    └──────────────┘  │  /api/admin/*          │ │
│                                      └────────────────────────┘ │
└──────┬──────────────────────┬──────────────────────┬────────────┘
       │                      │                      │
       ▼                      ▼                      ▼
┌─────────────┐   ┌───────────────────┐   ┌──────────────────────┐
│  MongoDB    │   │  FakeCatcher API  │   │  External Services   │
│  Atlas      │   │  (Render)         │   │                      │
│             │   │                   │   │  Clerk (Auth)        │
│  users      │   │  POST /v1/image/  │   │  Paystack (Payments) │
│  verifica-  │   │    predict        │   │  Sentry (Errors)     │
│  tionresults│   │  POST /v1/video/  │   │  Reality Defender    │
│  payments   │   │    predict/video  │   │    (SDK — disabled)  │
│  useraccess │   │  GET  /jobs/{id}  │   │                      │
│  bugreports │   │  GET  /jobs       │   │                      │
└─────────────┘   └───────────────────┘   └──────────────────────┘
```

---

## Core Data Flow

### Image Scan
1. User uploads image from dashboard
2. `POST /api/scans` receives multipart form data
3. API deducts 1 credit from user in MongoDB
4. File is forwarded to FakeCatcher backend (`POST /v1/image/predict`)
5. Result (REAL/FAKE + confidence) is stored in `verificationresults` collection
6. Scan ID returned to client; result page polls `/api/results/[id]`

### Video Scan
1. User uploads video (max 50 MB)
2. `POST /api/scans` forwards to FakeCatcher (`POST /v1/video/predict/video`)
3. Backend returns a `job_id` immediately (async processing)
4. Job metadata stored in-memory (`fakecatcherStore.ts` — in-process Map)
5. Client polls `/api/scans` → `/jobs/{job_id}` on the backend until `done`
6. Final result saved to MongoDB

### Payment Flow
1. User selects credit package on `/pricing-billing`
2. `POST /api/paystack/initialize` creates a Paystack transaction
3. User redirected to Paystack hosted checkout
4. On success, redirected to `/payment-success`
5. Paystack fires webhook to `POST /api/paystack/webhook`
6. Webhook verifies HMAC signature, adds credits to user in MongoDB

---

## Key Components

| File/Folder | Purpose |
|---|---|
| `app/api/scans/route.ts` | Core scan orchestration — credit deduction, file routing, backend proxy |
| `app/api/paystack/` | Payment initialization, verification, and webhook handler |
| `app/api/users/` | User sync from Clerk, dashboard data, trial activation |
| `app/api/admin/` | Admin-only endpoints: active users, compliance snapshot, access logs |
| `lib/fakecatcherStore.ts` | In-memory store for video job metadata and analysis results |
| `lib/realityDefender.ts` | Reality Defender SDK wrapper (currently disabled in production) |
| `lib/db.ts` | Mongoose connection with global cache for Next.js hot reload |
| `lib/logUserAccess.ts` | Middleware-triggered access logging to MongoDB |
| `middleware.ts` | Clerk auth + access logging on every request |
| `dist-workers/` | BullMQ worker for async Reality Defender scans (not active in serverless) |

---

## MongoDB Collections

| Collection | Description |
|---|---|
| `users` | Clerk-synced users with credits (default: 5) and plan tier |
| `verificationresults` | All scan results with status, confidence, model analysis, image preview |
| `payments` | Paystack transaction records for reconciliation |
| `useraccess` | Per-route access logs (clerkId, route, method, IP, timestamp) |
| `bugreports` | User-submitted bug reports |

---

## Authentication & Authorization

- **Clerk** handles all auth (sign-in, sign-up, session, JWT)
- `clerkMiddleware` runs on every request via `middleware.ts`
- Admin routes (`/admin/*`) require `userId` and are further gated by `adminAccess.ts`
- All API routes call `auth()` from `@clerk/nextjs/server` and return 401 if no session

---

## External Service Dependencies

| Service | Role | Current Host |
|---|---|---|
| FakeCatcher API | Deepfake detection for images and videos | Render (`facedetectionsystem.onrender.com`) |
| MongoDB Atlas | Primary database | MongoDB Cloud |
| Clerk | Authentication | Clerk Cloud |
| Paystack | Payment processing | Paystack Cloud |
| Sentry | Error monitoring | Sentry Cloud (`deeptrack` org) |
| Reality Defender | Secondary AI model (disabled) | SDK only |

---

## In-Memory State (Critical Limitation)

`lib/fakecatcherStore.ts` uses JavaScript `Map` objects to store:
- Video job metadata (userId, fileName, createdAt)
- FakeCatcher analysis results
- User feedback

**This state is lost on every server restart or new deployment.** This is a known architectural limitation. On Vercel (serverless), each function invocation may be a fresh instance, meaning video job state will not persist between the job submission request and the polling request unless they hit the same instance. This needs to be migrated to Redis or MongoDB before scaling.

---

## Credit System

- Each user starts with **5 free credits**
- Each scan costs **1 credit**
- Credits are purchased via Paystack
- Plans: `trial` → `starter` → `growth` → `enterprise`
- Credit deduction is atomic via MongoDB `findOneAndUpdate` with `$gte` guard to prevent overdraft

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/dashboard` | Main dashboard — recent scans, credit balance |
| `/history` | Full scan history with search, filter, delete |
| `/results/[id]` | Individual scan result detail |
| `/results/bulk` | Bulk scan results view |
| `/pricing-billing` | Credit packages and payment |
| `/payment-success` | Post-payment confirmation |
| `/report-bug` | Bug submission form |
| `/admin/dashboard` | Admin analytics (protected) |
| `/admin/bugs` | Bug report management (protected) |
| `/login` / `/signup` | Clerk auth pages |

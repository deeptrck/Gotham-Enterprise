# User Access Tracking Guide

## Overview
This implementation tracks user email access to your website and stores it in MongoDB. You can retrieve all active users within a specified timeframe.

## What's Tracked
- **Page visits**: Every authenticated page the user visits
- **API calls**: Every API endpoint accessed
- **Metadata**: User agent, IP address, timestamp, HTTP method (for APIs)

## How It Works

### 1. Access Logging (Automatic)
The middleware automatically logs all authenticated user access. No code changes needed for most routes.

**What gets logged:**
- `clerkId`: User's Clerk ID
- `email`: User's email (from User model)
- `accessType`: Either `"page_visit"` or `"api_call"`
- `routePath`: The path accessed (e.g., `/dashboard`, `/api/results`)
- `lastAccessedAt`: Timestamp of access
- User agent & IP address (optional)

### 2. Querying Active Users
Use the admin API endpoint to get currently active users:

```bash
# Get users active in last 24 hours (default)
curl -X GET "http://localhost:3000/api/admin/active-users" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"

# Get users active in last 7 days
curl -X GET "http://localhost:3000/api/admin/active-users?hours=168" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"

# Get users active in last hour
curl -X GET "http://localhost:3000/api/admin/active-users?hours=1" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

### 3. API Response Example
```json
{
  "success": true,
  "timeframe": "Last 24 hours",
  "totalActiveUsers": 3,
  "generatedAt": "2026-03-12T10:30:00.000Z",
  "data": [
    {
      "email": "user1@example.com",
      "clerkId": "user_abc123",
      "lastAccessedAt": "2026-03-12T09:15:00.000Z",
      "accessCount": 15,
      "recentActivities": [
        {
          "accessType": "api_call",
          "routePath": "/api/results",
          "method": "GET",
          "lastAccessedAt": "2026-03-12T09:15:00.000Z"
        },
        {
          "accessType": "page_visit",
          "routePath": "/dashboard",
          "method": "GET",
          "lastAccessedAt": "2026-03-12T08:45:00.000Z"
        }
      ]
    }
  ]
}
```

## Database Schema

### UserAccess Collection
```typescript
{
  _id: ObjectId,
  clerkId: string,        // Required, indexed
  email: string,          // Required, indexed
  accessType: "page_visit" | "api_call",
  routePath: string,      // e.g., "/dashboard"
  method?: string,        // e.g., "GET", "POST" (for APIs)
  userAgent?: string,
  ipAddress?: string,
  lastAccessedAt: Date,   // Indexed for efficient queries
  createdAt: Date,        // Auto-generated
  updatedAt: Date         // Auto-generated
}
```

## Advanced: Manual Access Logging

If you need to manually log access in a custom API route:

```typescript
import { logUserAccess } from "@/lib/logUserAccess";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Do your business logic...

  // Log the access (non-blocking)
  logUserAccess({
    clerkId: userId,
    accessType: "api_call",
    routePath: "/api/my-custom-route",
    method: "POST",
    userAgent: req.headers.get("user-agent") || undefined,
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0] || undefined,
  }).catch((err) => console.error("Failed to log access:", err));

  return NextResponse.json({ success: true });
}
```

## Database Indexes

The UserAccess model includes the following indexes for efficient queries:
- `clerkId` + `lastAccessedAt` (for per-user queries)
- `email` + `lastAccessedAt` (for email lookups)
- `lastAccessedAt` (for finding all active users in timeframe)

This ensures queries are fast even with millions of access records.

## Access Control

The `/api/admin/active-users` endpoint requires:
- Valid Clerk authentication (logged-in user)
- Admin email (must be in `ADMIN_EMAILS` environment variable)

Non-admin users will receive a 403 Forbidden response.

## Data Retention

Currently, access logs are retained **forever**. To add automatic cleanup:

Uncomment the TTL index in [lib/models/UserAccess.ts](../lib/models/UserAccess.ts#L30):
```typescript
// Automatically delete records older than 999 days
userAccessSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 * 999 });
```

## Querying MongoDB Directly

Get all users active in last 24 hours:
```javascript
db.useraccess.aggregate([
  {
    $match: {
      lastAccessedAt: { 
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) 
      }
    }
  },
  {
    $group: {
      _id: "$email",
      lastAccess: { $max: "$lastAccessedAt" },
      accessCount: { $sum: 1 }
    }
  },
  {
    $sort: { lastAccess: -1 }
  }
])
```

Get activity for a specific user:
```javascript
db.useraccess.find({ email: "user@example.com" }).sort({ lastAccessedAt: -1 }).limit(20)
```

## Performance Notes

- Access logging is **non-blocking** - logged asynchronously to not impact response times
- If logging fails, it's silently logged to console and doesn't break the app
- Compound indexes ensure queries remain fast with large datasets
- Consider archiving old logs to a separate collection if data grows very large

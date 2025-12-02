import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { VerificationResult } from "@/lib/models/VerificationResult";

// Cache for dashboard data (in-memory; ephemeral on serverless)
const dashboardCache = new Map<string, { data: any; timestamp: number }>();
const DASHBOARD_CACHE_TTL = 10 * 1000; // 10 seconds — short TTL to avoid stale data and large memory growth

/**
 * GET endpoint to fetch dashboard data (scans + credits) in a single call
 */
export async function GET(req: NextRequest) {
  const reqId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  console.time(`dashboard:${reqId}:total`);

  try {
    console.time(`dashboard:${reqId}:auth`);
    const { userId } = await auth();
    console.timeEnd(`dashboard:${reqId}:auth`);

    if (!userId) {
      console.timeEnd(`dashboard:${reqId}:total`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read pagination from query params (safe defaults)
    const url = new URL(req.url);
    const pageParam = url.searchParams.get("page");
    const limitParam = url.searchParams.get("limit");
    const page = Math.max(1, Number.isFinite(Number(pageParam)) ? Math.max(1, parseInt(pageParam || "1", 10)) : 1);
    let limit = Number.isFinite(Number(limitParam)) ? Math.max(1, Math.min(100, parseInt(limitParam || "20", 10))) : 20;

    // Check cache first. Include pagination in cache key.
    const cacheKey = `dashboard:${userId}:p${page}:l${limit}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < DASHBOARD_CACHE_TTL) {
      console.timeEnd(`dashboard:${reqId}:total`);
      return NextResponse.json(cached.data, { status: 200 });
    }

    console.time(`dashboard:${reqId}:connect`);
    await connectToDatabase();
    console.timeEnd(`dashboard:${reqId}:connect`);

    // Execute both queries in parallel but handle failures gracefully
    console.time(`dashboard:${reqId}:parallel-queries`);
    const skip = (page - 1) * limit;
    const promises = [
      User.findOne({ clerkId: userId }).select("credits").lean(),
      VerificationResult.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("_id scanId fileName status confidenceScore createdAt fileType imageUrl")
        .lean(),
    ];

    const settled = await Promise.allSettled(promises);
    console.timeEnd(`dashboard:${reqId}:parallel-queries`);

    const userResult = settled[0];
    const scansResult = settled[1];

    const user = userResult.status === 'fulfilled' ? (userResult.value as any) : null;
    const scans = scansResult.status === 'fulfilled' ? (scansResult.value as any) : [];

    const credits = user?.credits || 0;
    const responseData = { credits, scans: scans || [], page, limit };

    // Cache the response
    dashboardCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    console.timeEnd(`dashboard:${reqId}:total`);
    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error(`Error fetching dashboard data [${reqId}]:`, error);
    try { console.timeEnd(`dashboard:${reqId}:total`); } catch (e) {}
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
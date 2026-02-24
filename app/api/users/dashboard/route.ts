import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { VerificationResult } from "@/lib/models/VerificationResult";
import * as Sentry from "@sentry/nextjs";

// Cache for dashboard data (in-memory; ephemeral on serverless)
const dashboardCache = new Map<string, { data: DashboardResponse; timestamp: number }>();
const DASHBOARD_CACHE_TTL = 30 * 1000; // 30 seconds

// Type for a single scan summary returned to the frontend
type ScanSummary = {
  _id: string;
  scanId: string;
  fileName: string;
  status: string;
  confidenceScore: number;
  createdAt: string;
  fileType?: string;
  imageUrl?: string;
};

// Dashboard API response type
type DashboardResponse = {
  credits: number;
  scans: ScanSummary[];
  page: number;
  limit: number;
};

// Type for the User document we need
type UserDoc = {
  credits?: number;
};

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

    const url = new URL(req.url);
    const pageParam = url.searchParams.get("page");
    const limitParam = url.searchParams.get("limit");

    const page = Math.max(
      1,
      pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1
    );
    const limit = Math.max(
      1,
      Math.min(100, limitParam ? parseInt(limitParam, 10) : 20)
    );

    // Check cache first
    const cacheKey = `dashboard:${userId}:p${page}:l${limit}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < DASHBOARD_CACHE_TTL) {
      console.timeEnd(`dashboard:${reqId}:total`);
      return NextResponse.json(cached.data, { status: 200 });
    }

    console.time(`dashboard:${reqId}:connect`);
    await connectToDatabase();
    console.timeEnd(`dashboard:${reqId}:connect`);

    const skip = (page - 1) * limit;

    // Fetch user and scans in parallel with optimized queries
    const [userResult, scansResult] = await Promise.allSettled([
      User.findOne({ clerkId: userId })
        .select("credits")
        .maxTimeMS(2000)
        .lean({ virtuals: false, getters: false })
        .exec() as unknown as Promise<UserDoc | null>,
      VerificationResult.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("_id scanId fileName status confidenceScore createdAt fileType imageUrl")
        .maxTimeMS(5000)
        .lean({ virtuals: false, getters: false })
        .exec() as unknown as Promise<ScanSummary[]>,
    ]);

    const user: UserDoc | null = userResult.status === "fulfilled" ? (userResult.value as UserDoc | null) : null;
    const scans: ScanSummary[] = scansResult.status === "fulfilled" ? (scansResult.value as ScanSummary[]) : [];

    const responseData: DashboardResponse = {
      credits: user?.credits ?? 0,
      scans,
      page,
      limit,
    };

    // Cache the response
    dashboardCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    console.timeEnd(`dashboard:${reqId}:total`);
    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error(`Error fetching dashboard data [${reqId}]:`, error);
    Sentry.captureException(error);
    try {
      console.timeEnd(`dashboard:${reqId}:total`);
    } catch {}
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

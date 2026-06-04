import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/db";
import { VerificationResult } from "@/lib/models/VerificationResult";
import { User } from "@/lib/models/User";
import { getAdminEmailAllowlist, isEmailAllowlisted } from "@/lib/adminAccess";

// GET /api/admin/scans - Get all scans across all clients
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin access
    const user = await currentUser();
    const emails = [
      ...(user?.emailAddresses || []).map((entry) => entry.emailAddress?.trim().toLowerCase()),
      user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase(),
    ].filter((value): value is string => Boolean(value));

    const allowlist = getAdminEmailAllowlist();
    const allowed = isEmailAllowlisted(emails, allowlist);

    if (!allowed) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const verdict = searchParams.get("verdict");
    const mediaType = searchParams.get("media_type");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const query: Record<string, unknown> = {};

    if (verdict) {
      query.status = verdict.toUpperCase();
    }
    if (mediaType) {
      query.fileType = mediaType.toLowerCase();
    }
    if (from || to) {
      query.createdAt = {};
      if (from) (query.createdAt as Record<string, Date>).$gte = new Date(from);
      if (to) (query.createdAt as Record<string, Date>).$lte = new Date(to);
    }

    const skip = (page - 1) * limit;

    // Use aggregation pipeline for efficiency - get scans + stats in one query
    const [results, userIds] = await Promise.all([
      VerificationResult.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("scanId fileName fileType status confidenceScore createdAt reviewStatus userId rdAnalysis")
        .maxTimeMS(3000)
        .lean(),
      // Get unique user IDs from first 100 results to avoid loading all users
      VerificationResult.find(query)
        .select("userId")
        .limit(100)
        .lean()
        .then((docs) => [...new Set(docs.map((d) => (d as any).userId))]),
    ]);

    const scans = results;

    // Get user details only for the scans we're returning
    const users = await User.find({ clerkId: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u) => [u.clerkId, u]));

    // Transform scans to include client name
    const transformedScans = scans.map((scan) => {
      const user = userMap.get((scan as any).userId);
      return {
        id: (scan as any).scanId,
        client: user?.fullName || user?.email || "Unknown",
        fileName: (scan as any).fileName,
        type: (scan as any).fileType,
        verdict: (scan as any).status === "SUSPICIOUS" ? "review" : ((scan as any).status?.toLowerCase() || "unknown"),
        confidence: (scan as any).confidenceScore,
        reviewStatus: (scan as any).reviewStatus || null,
        time: (scan as any).createdAt?.toISOString() || new Date().toISOString(),
        credits_used: 1,
        processing_ms: (scan as any).rdAnalysis?.analyzedAt ? 1000 : null,
        created_at: (scan as any).createdAt,
      };
    });

    // Return lightweight response
    return NextResponse.json({
      scans: transformedScans,
      pagination: {
        page,
        limit,
        total: scans.length < limit ? skip + scans.length : "1000+",
      },
    });
  } catch (error) {
    console.error("Error fetching scans:", error);
    return NextResponse.json({ error: "Failed to fetch scans" }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/db";
import { VerificationResult } from "@/lib/models/VerificationResult";
import { User } from "@/lib/models/User";

// GET /api/admin/scans - Get all scans across all clients
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const [scans, total] = await Promise.all([
      VerificationResult.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VerificationResult.countDocuments(query),
    ]);

    // Get user details for each scan
    const userIds = [...new Set(scans.map((s) => s.userId))];
    const users = await User.find({ clerkId: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u) => [u.clerkId, u]));

    // Transform scans to include client name
    const transformedScans = scans.map((scan) => {
      const user = userMap.get(scan.userId);
      return {
        id: scan.scanId,
        client: user?.fullName || user?.email || "Unknown",
        type: scan.fileType,
        verdict: scan.status?.toLowerCase() || "unknown",
        confidence: scan.confidenceScore,
        time: scan.createdAt?.toISOString() || new Date().toISOString(),
        credits_used: 1,
        processing_ms: scan.rdAnalysis?.analyzedAt ? 1000 : null,
        created_at: scan.createdAt,
      };
    });

    return NextResponse.json({
      scans: transformedScans,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching scans:", error);
    return NextResponse.json({ error: "Failed to fetch scans" }, { status: 500 });
  }
}
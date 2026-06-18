import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { VerificationResult } from "@/lib/models/VerificationResult";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const hasDateFilter = !!(from || to);

    const dateFilter = hasDateFilter ? {
      createdAt: {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      },
    } : {};

    const avgConfidencePipeline: any[] = [];
    if (hasDateFilter) {
      avgConfidencePipeline.push({ $match: dateFilter });
    }
    avgConfidencePipeline.push({
      $group: { _id: null, avg: { $avg: "$confidenceScore" } },
    });

    const activeClientsPipeline: any[] = [];
    if (hasDateFilter) {
      activeClientsPipeline.push({ $match: dateFilter });
    }
    activeClientsPipeline.push({
      $group: { _id: "$userId" },
    });

    const [
      totalScansResult,
      avgConfidenceResult,
      pendingReviewResult,
      activeClientsResult,
      totalCreditsResult,
    ] = await Promise.all([
      VerificationResult.countDocuments(dateFilter),
      VerificationResult.aggregate(avgConfidencePipeline),
      VerificationResult.countDocuments({
        confidenceScore: { $gte: 50, $lte: 75 },
        $or: [
          { reviewStatus: { $exists: false } },
          { reviewStatus: "pending" },
        ],
      }),
      VerificationResult.aggregate(activeClientsPipeline),
      VerificationResult.countDocuments(dateFilter),
    ]);

    const avgConfidence = avgConfidenceResult.length > 0
      ? Math.round(avgConfidenceResult[0].avg * 10) / 10
      : 0;

    return NextResponse.json({
      scans_total: totalScansResult,
      credits_used: totalCreditsResult,
      active_clients: activeClientsResult.length,
      avg_confidence: avgConfidence,
      pending_review: pendingReviewResult,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin stats" },
      { status: 500 }
    );
  }
}

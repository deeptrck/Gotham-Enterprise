import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/db";
import { VerificationResult } from "@/lib/models/VerificationResult";

// GET /api/admin/fp-queue - Get scans flagged for review (FP/FN candidates)
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
    const type = searchParams.get("type"); // fp, fn, or all
    const status = searchParams.get("status"); // pending, confirmed, dismissed

    // Scans with confidence between 50-75% are auto-flagged for review
    const query: Record<string, unknown> = {
      confidenceScore: { $gte: 50, $lte: 75 },
    };

    if (type === "fp") {
      query.status = "DEEPFAKE";
    } else if (type === "fn") {
      query.status = "AUTHENTIC";
    }

    if (status) {
      query.reviewStatus = status;
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

    // Transform to FP/FN format
    const items = scans.map((scan) => {
      const isFP = scan.status === "DEEPFAKE";
      return {
        id: scan._id,
        scan_id: scan.scanId,
        icon: scan.fileType === "video" ? "🎬" : scan.fileType === "audio" ? "🎙" : "🖼",
        name: `${scan.fileName} — ${scan.userId.slice(0, 8)}`,
        detail: `Flagged: ${scan.status?.toLowerCase()} · Conf: ${scan.confidenceScore}% · Auto-escalated`,
        meta: `${scan.scanId} · ${scan.fileType} · ${scan.fileName}`,
        type: isFP ? "fp" : "fn",
        confidence: scan.confidenceScore,
        status: scan.reviewStatus || "pending",
        created_at: scan.createdAt,
      };
    });

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching FP queue:", error);
    return NextResponse.json({ error: "Failed to fetch FP queue" }, { status: 500 });
  }
}

// PATCH /api/admin/fp-queue - Update review status (confirm FP/FN, dismiss)
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { scanId, reviewStatus, feedbackType } = body;

    if (!scanId) {
      return NextResponse.json({ error: "Scan ID required" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (reviewStatus) update.reviewStatus = reviewStatus;
    if (feedbackType) update.feedbackType = feedbackType;

    const scan = await VerificationResult.findByIdAndUpdate(
      scanId,
      update,
      { new: true }
    );

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    return NextResponse.json(scan);
  } catch (error) {
    console.error("Error updating FP queue:", error);
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
  }
}
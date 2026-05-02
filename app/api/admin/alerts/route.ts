import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { VerificationResult } from "@/lib/models/VerificationResult";

// GET /api/admin/alerts - Get system alerts
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const alerts: Array<{ level: "error" | "warn"; title: string; body: string }> = [];

    // Check 1: Clients hitting credit limits
    const users = await User.find({ 
      $expr: { $lte: ["$credits", { $multiply: ["$creditsUsed", 0.2] }] }
    }).lean();

    users.forEach((u) => {
      const usagePct = u.creditsUsed && u.credits ? Math.round((u.creditsUsed / u.credits) * 100) : 0;
      if (usagePct >= 80) {
        alerts.push({
          level: usagePct >= 90 ? "error" : "warn",
          title: `${u.email?.split("@")[0]} hitting credit limit`,
          body: `${usagePct}% of ${u.plan || "starter"} plan used. Upsell opportunity.`,
        });
      }
    });

    // Check 2: Model confidence drift (compare last 7 days vs 30 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [recentScans, olderScans] = await Promise.all([
      VerificationResult.find({
        createdAt: { $gte: sevenDaysAgo },
        confidenceScore: { $exists: true },
      }).lean(),
      VerificationResult.find({
        createdAt: { $gte: thirtyDaysAgo, $lt: sevenDaysAgo },
        confidenceScore: { $exists: true },
      }).lean(),
    ]);

    if (recentScans.length > 10 && olderScans.length > 10) {
      const recentAvg = recentScans.reduce((sum, s) => sum + s.confidenceScore, 0) / recentScans.length;
      const olderAvg = olderScans.reduce((sum, s) => sum + s.confidenceScore, 0) / olderScans.length;
      const drift = recentAvg - olderAvg;

      if (Math.abs(drift) > 3) {
        alerts.push({
          level: "warn",
          title: "Model confidence drift detected",
          body: `Audio avg confidence ${drift > 0 ? "up" : "down"} ${Math.abs(drift).toFixed(1)}pts in 7 days.`,
        });
      }
    }

    // Check 3: High error rate scans
    const errorScans = await VerificationResult.countDocuments({
      status: "ERROR",
      createdAt: { $gte: sevenDaysAgo },
    });

    if (errorScans > 10) {
      alerts.push({
        level: "warn",
        title: "Elevated scan error rate",
        body: `${errorScans} scans failed in the last 7 days. Check system health.`,
      });
    }

    // Check 4: Pending reviews
    const pendingReviews = await VerificationResult.countDocuments({
      confidenceScore: { $gte: 50, $lte: 75 },
      $or: [
        { reviewStatus: { $exists: false } },
        { reviewStatus: "pending" },
      ],
    });

    if (pendingReviews > 20) {
      alerts.push({
        level: "warn",
        title: "Review queue building up",
        body: `${pendingReviews} scans awaiting FP/FN review.`,
      });
    }

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { alertId, action } = body;
    if (!alertId || !action) {
      return NextResponse.json({ error: "alertId and action are required" }, { status: 400 });
    }

    return NextResponse.json({ success: true, alertId, action });
  } catch (error) {
    console.error("Error updating alert:", error);
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}
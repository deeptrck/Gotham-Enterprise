import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
    const alertUsers = await User.aggregate([
      {
        $match: {
          credits: { $exists: true, $gt: 0 },
          creditsUsed: { $exists: true },
        },
      },
      {
        $addFields: {
          usagePct: {
            $multiply: [{ $divide: ["$creditsUsed", "$credits"] }, 100],
          },
        },
      },
      { $match: { usagePct: { $gte: 80 } } },
      { $project: { email: 1, plan: 1, credits: 1, creditsUsed: 1, usagePct: 1 } },
      { $sort: { usagePct: -1 } },
      { $limit: 50 },
    ]).option({ maxTimeMS: 3000 }).exec();

    alertUsers.forEach((u: any) => {
      const usagePct = Math.round(u.usagePct || 0);
      alerts.push({
        level: usagePct >= 90 ? "error" : "warn",
        title: `${u.email?.split("@")[0]} hitting credit limit`,
        body: `${usagePct}% of ${u.plan || "starter"} plan used. Upsell opportunity.`,
      });
    });

    // Check 2: Model confidence drift (compare last 7 days vs 30 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [recentAgg, olderAgg] = await Promise.all([
      VerificationResult.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo }, confidenceScore: { $exists: true } } },
        { $group: { _id: null, avgScore: { $avg: "$confidenceScore" }, count: { $sum: 1 } } },
      ]).option({ maxTimeMS: 3000 }).exec(),
      VerificationResult.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo, $lt: sevenDaysAgo },
            confidenceScore: { $exists: true },
          },
        },
        { $group: { _id: null, avgScore: { $avg: "$confidenceScore" }, count: { $sum: 1 } } },
      ]).option({ maxTimeMS: 3000 }).exec(),
    ]);

    const recentCount = recentAgg?.[0]?.count ?? 0;
    const olderCount = olderAgg?.[0]?.count ?? 0;
    const recentAvg = recentAgg?.[0]?.avgScore ?? 0;
    const olderAvg = olderAgg?.[0]?.avgScore ?? 0;

    if (recentCount > 10 && olderCount > 10) {
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
    }).maxTimeMS(3000).exec();

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
    }).maxTimeMS(3000).exec();

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
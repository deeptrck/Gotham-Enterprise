import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { Payment } from "@/lib/models/Payment";
import { VerificationResult } from "@/lib/models/VerificationResult";

// GET /api/admin/credits - Get credit overview for all clients
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Get all users with credits
    const users = await User.find({ 
      $or: [
        { credits: { $gt: 0 } },
        { creditsUsed: { $gt: 0 } }
      ]
    }).lean();

    // Get all payments for ledger
    const payments = await Payment.find({ status: "success" })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Calculate totals
    const totalCredits = users.reduce((sum, u) => sum + (u.credits || 0), 0);
    const totalUsed = users.reduce((sum, u) => sum + (u.creditsUsed || 0), 0);
    const totalIssued = users.reduce((sum, u) => sum + (u.credits || 0) + (u.creditsUsed || 0), 0);
    const totalPurchased = payments.reduce((sum, p) => sum + (p.credits || 0), 0);

    // Compute near-limit clients (>= 90% usage)
    const nearLimitUsers = users.filter((u) => {
      const total = (u.credits || 0) + (u.creditsUsed || 0);
      return total > 0 && ((u.creditsUsed || 0) / total) * 100 >= 90;
    });
    const nearLimitCount = nearLimitUsers.length;
    const nearLimitNames = nearLimitUsers.map((u) => u.fullName || u.email || "Unknown").join(" · ");

    // Group by plan
    const byPlan: Record<string, { count: number; credits: number; used: number }> = {};
    users.forEach((u) => {
      const plan = u.plan || "starter";
      if (!byPlan[plan]) {
        byPlan[plan] = { count: 0, credits: 0, used: 0 };
      }
      byPlan[plan].count++;
      byPlan[plan].credits += u.credits || 0;
      byPlan[plan].used += u.creditsUsed || 0;
    });

    // ── Monthly credit usage (rolling 12 complete months) ──────────────────
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyAgg = await VerificationResult.aggregate([
      {
        $match: {
          createdAt: {
            $gte: twelveMonthsAgo,
            $lt: currentMonthStart,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          usage: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const usageMap = new Map<string, number>();
    for (const entry of monthlyAgg) {
      usageMap.set(`${entry._id.year}-${entry._id.month}`, entry.usage);
    }

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyUsage: { month: string; usage: number }[] = [];
    for (let i = 12; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      monthlyUsage.push({
        month: monthNames[m - 1],
        usage: usageMap.get(`${y}-${m}`) || 0,
      });
    }

    // ── Resolve user names for ledger enrichment ──────────────────────────
    const allUsers = await User.find({}, { clerkId: 1, fullName: 1, email: 1 }).lean();
    const userMap = new Map<string, string>();
    for (const u of allUsers) {
      if (u.clerkId) userMap.set(u.clerkId.toString(), u.fullName || u.email || "Unknown");
      if (u._id) userMap.set(u._id.toString(), u.fullName || u.email || "Unknown");
    }

    // Transform ledger entries (enriched with client_name)
    const ledger = payments.map((p) => ({
      id: p._id,
      client_id: p.clerkId || p.userId,
      client_name: userMap.get(p.clerkId?.toString() || "") || userMap.get(p.userId?.toString() || "") || "Unknown",
      type: p.type || "purchase",
      amount: p.credits || p.amount || 0,
      note: p.reference || (p.type === "adjustment" ? "Manual adjustment" : "Transaction"),
      created_at: p.createdAt,
      status: p.status,
    }));

    return NextResponse.json({
      summary: {
        total_credits: totalCredits,
        total_used: totalUsed,
        total_issued: totalIssued,
        total_purchased: totalPurchased,
        active_clients: users.length,
        near_limit_count: nearLimitCount,
        near_limit_names: nearLimitNames,
      },
      by_plan: byPlan,
      ledger,
      monthly_usage: monthlyUsage,
    });
  } catch (error) {
    console.error("Error fetching credits:", error);
    return NextResponse.json({ error: "Failed to fetch credits" }, { status: 500 });
  }
}

// POST /api/admin/credits - Add manual credit adjustment
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { userId: targetUserId, amount, type } = body;

    if (!targetUserId || typeof amount !== "number") {
      return NextResponse.json({ error: "userId and amount required" }, { status: 400 });
    }

    // Find user
    const user = await User.findOne({ clerkId: targetUserId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Always additive — credits + creditsUsed must remain consistent
    const newCredits = (user.credits || 0) + amount;

    await User.updateOne(
      { clerkId: targetUserId },
      { credits: Math.max(0, newCredits) }
    );

    // Create payment record for the adjustment
    await Payment.create({
      userId: targetUserId,
      amount: Math.abs(amount),
      type: type || "adjustment",
      status: "success",
      paymentMethod: "manual",
    });

    return NextResponse.json({ success: true, credits: newCredits });
  } catch (error) {
    console.error("Error adjusting credits:", error);
    return NextResponse.json({ error: "Failed to adjust credits" }, { status: 500 });
  }
}
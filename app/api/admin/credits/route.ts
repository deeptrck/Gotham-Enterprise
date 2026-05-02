import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { Payment } from "@/lib/models/Payment";

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
    const totalPurchased = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

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

    // Transform ledger entries
    const ledger = payments.map((p) => ({
      id: p._id,
      client_id: p.userId,
      type: p.type || "purchase",
      amount: p.amount || 0,
      credits_before: (p.amount || 0) - (p.amount || 0),
      credits_after: p.amount || 0,
      created_at: p.createdAt,
      status: p.status,
    }));

    return NextResponse.json({
      summary: {
        total_credits: totalCredits,
        total_used: totalUsed,
        total_purchased: totalPurchased,
        active_clients: users.length,
      },
      by_plan: byPlan,
      ledger,
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

    // Update credits
    const newCredits = type === "adjustment" 
      ? (user.credits || 0) + amount
      : amount;

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
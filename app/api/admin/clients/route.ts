import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { Payment } from "@/lib/models/Payment";

// GET /api/admin/clients - Get all clients with their credit info
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
    const plan = searchParams.get("plan");

    const query: Record<string, unknown> = {};

    // Filter by plan if provided
    if (plan) {
      query.plan = plan.toLowerCase();
    }

    const skip = (page - 1) * limit;

    // Get all users (clients)
    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    // Get payment/credit info for each user
    const userIds = users.map((u) => u.clerkId);
    const payments = await Payment.find({ userId: { $in: userIds } })
      .sort({ createdAt: -1 })
      .lean();

    // Group payments by userId
    const paymentsByUser = new Map<string, typeof payments>();
    payments.forEach((p) => {
      const existing = paymentsByUser.get(p.userId) || [];
      existing.push(p);
      paymentsByUser.set(p.userId, existing);
    });

    // Calculate credits for each user
    const transformedClients = users.map((user) => {
      const userPayments = paymentsByUser.get(user.clerkId) || [];
      
      // Calculate total credits purchased
      const totalCredits = userPayments.reduce((sum, p) => {
        if (p.status === "success") {
          return sum + (p.amount || 0);
        }
        return sum;
      }, 0);

      // Calculate credits used (from scan count or stored value)
      const creditsUsed = user.creditsUsed || 0;
      const creditsRemaining = user.credits || totalCredits - creditsUsed;

      return {
        id: user._id,
        name: user.fullName || user.email || "Unknown",
        email: user.email,
        plan: user.plan || "starter",
        used: creditsUsed,
        total: totalCredits,
        credits_remaining: creditsRemaining,
        calls: user.scanCount || 0,
        created_at: user.createdAt,
        last_active: user.updatedAt,
      };
    });

    return NextResponse.json({
      clients: transformedClients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}

// PATCH /api/admin/clients/{id} - Update client (upgrade plan, etc.)
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("id");

    if (!clientId) {
      return NextResponse.json({ error: "Client ID required" }, { status: 400 });
    }

    const body = await req.json();
    const { plan, credits } = body;

    const update: Record<string, unknown> = {};
    if (plan) update.plan = plan.toLowerCase();
    if (typeof credits === "number") update.credits = credits;

    const user = await User.findByIdAndUpdate(clientId, update, { new: true });

    if (!user) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  }
}

// PUT /api/admin/clients - Create new client
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { name, email, plan, credits } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email required" }, { status: 400 });
    }

    // Create user (in production, this would integrate with Clerk)
    const user = await User.create({
      fullName: name,
      email,
      plan: plan || "starter",
      credits: credits || 100,
      isActive: true,
    });

    return NextResponse.json({
      id: user._id,
      name: user.fullName,
      email: user.email,
      plan: user.plan,
      credits: user.credits,
    });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}

// DELETE /api/admin/clients/{id} - Suspend or delete client
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("id");
    const action = searchParams.get("action"); // "suspend" or "delete"

    if (!clientId) {
      return NextResponse.json({ error: "Client ID required" }, { status: 400 });
    }

    if (action === "delete") {
      // Hard delete
      await User.findByIdAndDelete(clientId);
    } else {
      // Suspend - mark as inactive
      await User.findByIdAndUpdate(clientId, { isActive: false });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting/suspending client:", error);
    return NextResponse.json({ error: "Failed to delete/suspend client" }, { status: 500 });
  }
}
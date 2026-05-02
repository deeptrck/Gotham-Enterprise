import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/db";
import mongoose from "mongoose";

// Webhooks schema
const webhookSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  url: { type: String, required: true },
  events: [{ type: String }],
  secret: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const Webhook = mongoose.models.Webhook || mongoose.model("Webhook", webhookSchema);

// GET /api/admin/webhooks - Get all webhooks
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const webhooks = await Webhook.find().sort({ createdAt: -1 }).lean();

    // Get user details
    const userIds = [...new Set(webhooks.map((w) => w.userId))];
    const { User } = await import("@/lib/models/User");
    const users = await User.find({ clerkId: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u) => [u.clerkId, u]));

    const transformed = webhooks.map((w) => ({
      id: w._id,
      name: w.name,
      url: w.url,
      events: w.events,
      is_active: w.isActive,
      created_at: w.createdAt,
      client: userMap.get(w.userId)?.fullName || w.userId.slice(0, 8),
      trigger: `Fires: ${w.events?.join(", ") || "all events"}`,
    }));

    return NextResponse.json({ webhooks: transformed });
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
  }
}

// POST /api/admin/webhooks - Create webhook
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { name, url, client, trigger, events } = body;

    if (!name || !url) {
      return NextResponse.json({ error: "name and url required" }, { status: 400 });
    }

    const webhookEvents = events || (trigger ? [trigger] : ["scan.completed"]);
    const secret = Math.random().toString(36).substring(2, 26);

    const webhook = await Webhook.create({
      userId,
      name,
      url,
      events: webhookEvents,
      secret,
      isActive: true,
      client: client || "Unknown",
    });

    return NextResponse.json({
      id: webhook._id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      secret: secret, // Only returned once!
    });
  } catch (error) {
    console.error("Error creating webhook:", error);
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }
}

// PATCH /api/admin/webhooks - Update webhook
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const webhookId = searchParams.get("id");

    if (!webhookId) {
      return NextResponse.json({ error: "Webhook ID required" }, { status: 400 });
    }

    const body = await req.json();
    const { name, url, events, trigger, client, isActive } = body;

    const update: Record<string, unknown> = {};
    if (name) update.name = name;
    if (url) update.url = url;
    if (events) update.events = events;
    if (trigger) update.events = [trigger];
    if (client) update.client = client;
    if (typeof isActive === "boolean") update.isActive = isActive;

    const webhook = await Webhook.findByIdAndUpdate(webhookId, update, { new: true });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: webhook._id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      is_active: webhook.isActive,
    });
  } catch (error) {
    console.error("Error updating webhook:", error);
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
  }
}

// DELETE /api/admin/webhooks - Delete webhook
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const webhookId = searchParams.get("id");

    if (!webhookId) {
      return NextResponse.json({ error: "Webhook ID required" }, { status: 400 });
    }

    await Webhook.findByIdAndDelete(webhookId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting webhook:", error);
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}
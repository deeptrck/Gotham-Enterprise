import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import mongoose from "mongoose";

// API Keys schema (stored in MongoDB)
const apiKeySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  keyPrefix: { type: String, required: true },
  keyHash: { type: String, required: true },
  environment: { type: String, enum: ["test", "live"], required: true },
  isActive: { type: Boolean, default: true },
  lastUsed: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const ApiKey = mongoose.models.ApiKey || mongoose.model("ApiKey", apiKeySchema);

// GET /api/admin/api-keys - Get all API keys
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const environment = searchParams.get("env");
    const active = searchParams.get("active");

    const query: Record<string, unknown> = {};
    if (environment) query.environment = environment;
    if (active !== null) query.isActive = active === "true";

    const keys = await ApiKey.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Get user details for each key
    const userIds = [...new Set(keys.map((k) => k.userId))];
    const { User } = await import("@/lib/models/User");
    const users = await User.find({ clerkId: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u) => [u.clerkId, u]));

    const transformed = keys.map((key) => ({
      id: key._id,
      name: key.name,
      prefix: key.keyPrefix,
      env: key.environment,
      is_active: key.isActive,
      last_used: key.lastUsed,
      created_at: key.createdAt,
      client: userMap.get(key.userId)?.fullName || key.userId.slice(0, 8),
    }));

    return NextResponse.json({ keys: transformed });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
  }
}

// POST /api/admin/api-keys - Create new API key
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { name, environment, userId: targetUserId } = body;

    if (!name || !environment || !targetUserId) {
      return NextResponse.json({ error: "name, environment, and userId required" }, { status: 400 });
    }

    // Generate key
    const rawKey = `gt_${environment}_${Math.random().toString(36).substring(2, 26)}`;
    const keyPrefix = rawKey.substring(0, 12);
    
    // Hash the key (in production, use proper SHA-256)
    const keyHash = Buffer.from(rawKey).toString("base64");

    const apiKey = await ApiKey.create({
      userId: targetUserId,
      name,
      keyPrefix,
      keyHash,
      environment,
      isActive: true,
    });

    // Return the raw key only once
    return NextResponse.json({
      id: apiKey._id,
      name: apiKey.name,
      prefix: apiKey.keyPrefix,
      env: apiKey.environment,
      raw_key: rawKey, // Only returned once!
    });
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}

// DELETE /api/admin/api-keys - Revoke API key
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get("id");

    if (!keyId) {
      return NextResponse.json({ error: "Key ID required" }, { status: 400 });
    }

    // Soft delete - just mark as inactive
    await ApiKey.findByIdAndUpdate(keyId, { isActive: false });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking API key:", error);
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
  }
}
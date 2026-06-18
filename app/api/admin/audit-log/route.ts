import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import mongoose from "mongoose";

// Audit Log schema (INSERT-only)
const auditLogSchema = new mongoose.Schema({
  actorId: { type: String, required: true },
  actorRole: { type: String },
  action: { type: String, required: true },
  target: { type: String },
  targetType: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

// Prevent updates
auditLogSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace"], function() {
  throw new Error("Audit log cannot be updated");
});

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

// GET /api/admin/audit-log - Get audit logs
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
    const action = searchParams.get("action");
    const actor = searchParams.get("actor");

    const query: Record<string, unknown> = {};
    if (action) query.action = { $regex: action, $options: "i" };
    if (actor) query.actorId = { $regex: actor, $options: "i" };

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log._id,
        actor: log.actorId,
        role: log.actorRole || "admin",
        action: log.action,
        target: log.target || "-",
        ip: log.ipAddress || "-",
        timestamp: log.createdAt,
        details: log.details,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
  }
}

// POST /api/admin/audit-log - Create audit log entry
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { action, target, targetType, details } = body;

    if (!action) {
      return NextResponse.json({ error: "action required" }, { status: 400 });
    }

    const log = await AuditLog.create({
      actorId: userId,
      actorRole: "admin",
      action,
      target,
      targetType,
      details,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0],
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ id: log._id, success: true });
  } catch (error) {
    console.error("Error creating audit log:", error);
    return NextResponse.json({ error: "Failed to create audit log" }, { status: 500 });
  }
}
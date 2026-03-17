import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { BugReport } from "@/lib/models/BugReport";
import { getAdminEmailAllowlist, isEmailAllowlisted } from "@/lib/adminAccess";

const requireAdmin = async () => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await currentUser();
  const emails = (user?.emailAddresses || [])
    .map((entry) => entry.emailAddress?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  const allowlist = getAdminEmailAllowlist();
  const allowed = isEmailAllowlisted(emails, allowlist);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await connectToDatabase();
  return null;
};

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const errorResponse = await requireAdmin();
  if (errorResponse) return errorResponse;

  const body = await request.json();
  const { status } = body as { status?: "open" | "resolved" };

  if (!status || (status !== "open" && status !== "resolved")) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  console.log("PATCH bug id", id, "status", status);
  const updated = await BugReport.findByIdAndUpdate(id, { status }, { new: true }).lean();
  console.log("PATCH result", updated);
  if (!updated) {
    return NextResponse.json({ error: "Bug not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, bug: updated });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const errorResponse = await requireAdmin();
  if (errorResponse) return errorResponse;

  const deleted = await BugReport.findByIdAndDelete(id).lean();
  if (!deleted) {
    return NextResponse.json({ error: "Bug not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

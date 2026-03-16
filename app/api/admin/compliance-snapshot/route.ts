import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAdminEmailAllowlist, isEmailAllowlisted } from "@/lib/adminAccess";
import { connectToDatabase } from "@/lib/db";
import { BugReport } from "@/lib/models/BugReport";

export async function GET() {
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
  const bugCount = await BugReport.countDocuments();
  const openCount = await BugReport.countDocuments({ status: "open" });

  const snapshotId = `snapshot-${Date.now()}`;
  return NextResponse.json({
    snapshotId,
    generatedAt: new Date().toISOString(),
    bugCount,
    openCount,
    message: "Compliance snapshot generated successfully.",
  });
}

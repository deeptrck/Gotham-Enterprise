import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { BugReport } from "@/lib/models/BugReport";
import { getAdminEmailAllowlist, isEmailAllowlisted } from "@/lib/adminAccess";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, page, priority } = body as {
    title?: string;
    description?: string;
    page?: string;
    priority?: "low" | "medium" | "high";
  };

  if (!title?.trim() || !description?.trim()) {
    return NextResponse.json({ error: "Title and description are required" }, { status: 400 });
  }

  const user = await currentUser();

  await connectToDatabase();
  const bug = new BugReport({
    userId,
    userEmail: user?.primaryEmailAddress?.emailAddress,
    title: title.trim(),
    description: description.trim(),
    page: page?.trim() || "",
    priority: priority || "medium",
    status: "open",
  });
  await bug.save();

  return NextResponse.json({ success: true, id: bug._id }, { status: 201 });
}

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
  const bugs = await BugReport.find().sort({ createdAt: -1 }).limit(200).lean();
  return NextResponse.json({ bugs });
}

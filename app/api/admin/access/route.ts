import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAdminEmailAllowlist, isEmailAllowlisted } from "@/lib/adminAccess";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ allowed: false }, { status: 200 });
  }

  const user = await currentUser();
  const emails = (user?.emailAddresses || [])
    .map((entry) => entry.emailAddress?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  const allowlist = getAdminEmailAllowlist();
  const allowed = isEmailAllowlisted(emails, allowlist);

  return NextResponse.json({
    allowed,
    configured: allowlist.length > 0,
  });
}

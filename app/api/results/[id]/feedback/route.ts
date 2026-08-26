import { NextResponse } from "next/server";
import { auth, getOrganizationId } from "@/lib/auth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { userId, user } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const organizationId = getOrganizationId(user);
  if (!organizationId) return NextResponse.json({ error: "Organization context required" }, { status: 403 });
  return NextResponse.json({ error: "Result feedback is temporarily unavailable during the PostgreSQL migration", resultId: id }, { status: 501 });
}

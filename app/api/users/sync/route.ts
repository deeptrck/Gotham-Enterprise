import { NextRequest, NextResponse } from "next/server";
import { auth, getOrganizationId } from "@/lib/auth";
import { upsertUser, findUserByAuth0Sub } from "@/lib/repositories/users";
import * as Sentry from "@sentry/nextjs";

function serializeUser(user: Awaited<ReturnType<typeof upsertUser>>) {
  return {
    _id: user.id,
    id: user.id,
    auth0Sub: user.auth0_sub,
    email: user.email,
    fullName: user.full_name,
    imageUrl: user.image_url,
    credits: user.credits,
    creditsUsed: user.credits_used,
    scanCount: user.scan_count,
    plan: user.plan,
    trialUsed: user.trial_used,
    status: user.status,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ success: true, skipped: true }, { status: 200 });
    const organizationId = getOrganizationId((await auth()).user);
    if (!organizationId) return NextResponse.json({ error: "Organization context required" }, { status: 403 });
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : null;
    if (!email) return NextResponse.json({ error: "Email is required for user sync" }, { status: 400 });
    const user = await upsertUser({ scope: { organizationId }, auth0Sub: userId, email, fullName: fullName || email.split("@")[0] || "User", imageUrl });
    return NextResponse.json(serializeUser(user), { status: 200 });
  } catch (error) {
    console.error("Error syncing PostgreSQL user:", error);
    Sentry.captureException(error);
    const err = error as { code?: string; constraint?: string };
    if (err.code === "23505" || err.constraint?.includes("email")) return NextResponse.json({ error: "Email is already linked to another account" }, { status: 409 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = getOrganizationId((await auth()).user);
    if (!organizationId) return NextResponse.json({ error: "Organization context required" }, { status: 403 });
    const user = await findUserByAuth0Sub({ organizationId }, userId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json(serializeUser(user), { status: 200 });
  } catch (error) {
    console.error("Error fetching PostgreSQL user:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

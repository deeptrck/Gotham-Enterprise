import { NextResponse } from "next/server";
import { auth, getOrganizationId } from "@/lib/auth";
import { findUserByAuth0Sub, activateTrial } from "@/lib/repositories/users";
import * as Sentry from "@sentry/nextjs";

export async function POST() {
  try {
    const { userId, user: sessionUser } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrganizationId(sessionUser);
    if (!organizationId) return NextResponse.json({ error: "Organization context required" }, { status: 403 });
    const account = await findUserByAuth0Sub({ organizationId, actorUserId: userId }, userId);
    if (!account) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (account.trial_used) return NextResponse.json({ error: "Trial already claimed. Please purchase credits to continue." }, { status: 400 });
    const updated = await activateTrial({ organizationId, actorUserId: userId }, account.id, 10);
    if (!updated) return NextResponse.json({ error: "Trial already claimed. Please purchase credits to continue." }, { status: 400 });
    return NextResponse.json({ success: true, credits: updated.credits });
  } catch (err) {
    console.error("Error subscribing to trial:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

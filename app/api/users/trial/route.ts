import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import * as Sentry from "@sentry/nextjs";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findOne({ clerkId: userId });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Grant trial credits (idempotent: only grant if user has <= default)
    const TRIAL_CREDITS = 5;

    if (!user.credits || user.credits < TRIAL_CREDITS) {
      user.credits = TRIAL_CREDITS;
    }

    user.plan = "trial";
    await user.save();

    return NextResponse.json({ success: true, credits: user.credits });
  } catch (err) {
    console.error("Error subscribing to trial:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

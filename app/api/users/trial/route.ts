import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import * as Sentry from "@sentry/nextjs";

export async function POST() {
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

    if (user.trialUsed) {
      return NextResponse.json(
        { error: "Trial already claimed. Please purchase credits to continue." },
        { status: 400 }
      );
    }

    const TRIAL_CREDITS = 10;
    if (!user.credits || user.credits < TRIAL_CREDITS) {
      user.credits = TRIAL_CREDITS;
    }

    user.plan = "trial";
    user.trialUsed = true;
    await user.save();

    return NextResponse.json({ success: true, credits: user.credits });
  } catch (err) {
    console.error("Error subscribing to trial:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      // Don’t hard-fail during OAuth/login while Clerk session cookies are establishing.
      // This prevents the UI from erroring; sync can be retried once authenticated.
      return NextResponse.json({ success: true, skipped: true }, { status: 200 });
    }

    const body = await req.json();
    const rawEmail = typeof body?.email === "string" ? body.email.trim() : "";
    const rawFullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : undefined;

    if (!rawEmail) {
      return NextResponse.json({ error: "Email is required for user sync" }, { status: 400 });
    }

    const email = rawEmail.toLowerCase();
    const fullName = rawFullName || email.split("@")[0] || "User";

    await connectToDatabase();

    const user = await User.findOneAndUpdate(
      {
        $or: [
          { clerkId: userId },
          { email },
        ],
      },
      {
        $set: { clerkId: userId, email, fullName, imageUrl },
        $setOnInsert: {
          credits: 0,
          creditsUsed: 0,
          plan: "trial",
          trialUsed: false,
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    console.error("Error syncing user:", error);
    Sentry.captureException(error);
    const err = error as { code?: number; keyPattern?: Record<string, unknown> };
    if (err?.code === 11000 && err?.keyPattern?.email) {
      return NextResponse.json(
        { error: "Email is already linked to another account" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
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

    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    console.error("Error fetching user:", error);
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
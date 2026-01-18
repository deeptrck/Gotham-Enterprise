import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { Payment } from "@/lib/models/Payment";
import * as Sentry from "@sentry/nextjs";

const PAYSTACK_VERIFY_URL = "https://api.paystack.co/transaction/verify";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { reference } = body;

    if (!reference) {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: "Paystack secret key not configured" }, { status: 500 });
    }

    // Verify with Paystack
    const res = await fetch(`${PAYSTACK_VERIFY_URL}/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await res.json();

    if (!res.ok || !data || data.status !== true) {
      console.error("Paystack verify error", data);
      return NextResponse.json({ error: "Failed to verify payment" }, { status: 400 });
    }

    const payment = data.data;

    if (payment.status !== "success") {
      return NextResponse.json({ error: "Payment not successful" }, { status: 400 });
    }

    // Read credits and clerkId from metadata (we passed them during initialize)
    const creditsToAdd = Number(payment.metadata?.credits || 0);
    const metadataClerkId = payment.metadata?.clerkId as string | undefined;

    if (!creditsToAdd || creditsToAdd <= 0) {
      return NextResponse.json({ error: "No credits found in payment metadata" }, { status: 400 });
    }

    await connectToDatabase();

    // Idempotency: check if this reference already exists and was processed
    const existing = await Payment.findOne({ reference: payment.reference });

    if (existing && existing.processed) {
      return NextResponse.json({ success: true, credits: existing.credits, message: "Already processed" });
    }

    // If metadata contains clerkId, ensure it matches authenticated user
    if (metadataClerkId && metadataClerkId !== userId) {
      return NextResponse.json({ error: "Payment metadata does not match authenticated user" }, { status: 403 });
    }

    const user = await User.findOne({ clerkId: userId });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Apply credits
    user.credits = (user.credits || 0) + creditsToAdd;
    await user.save();

    // Create or update payment record
    if (existing) {
      existing.status = payment.status;
      existing.processed = true;
      existing.credits = creditsToAdd;
      existing.raw = payment;
      existing.clerkId = metadataClerkId || userId;
      await existing.save();
    } else {
      await Payment.create({
        reference: payment.reference,
        clerkId: metadataClerkId || userId,
        email: user.email,
        amount: payment.amount || 0,
        currency: payment.currency || "USD",
        credits: creditsToAdd,
        status: payment.status,
        processed: true,
        raw: payment,
      });
    }

    return NextResponse.json({ success: true, credits: user.credits });
  } catch (error) {
    console.error("Error verifying paystack transaction:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import * as Sentry from "@sentry/nextjs";

const PAYSTACK_INIT_URL = "https://api.paystack.co/transaction/initialize";

interface PaymentPayload {
  email: string;
  amount: number;
  currency: string;
  metadata: {
    credits: number;
    clerkId: string;
  };
  callback_url?: string;
}


export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { amount, credits, currency = "USD" } = body; // amount expected in main currency units (USD)

    if (!amount || !credits) {
      return NextResponse.json({ error: "Missing amount or credits" }, { status: 400 });
    }

    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    const PAYSTACK_CALLBACK_URL = process.env.PAYSTACK_CALLBACK_URL;

    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: "Paystack secret key not configured" }, { status: 500 });
    }

    await connectToDatabase();

    const user = await User.findOne({ clerkId: userId });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Paystack expects amount in the smallest currency unit (e.g., cents for USD)
    const amountInSmallest = Math.round(Number(amount) * 100);

    const payload: PaymentPayload = {
      email: user.email,
      amount: amountInSmallest,
      currency,
      metadata: {
        credits,
        clerkId: userId,
      },
    };

    // Construct callback URL to payment success page (will include reference as query param)
    if (PAYSTACK_CALLBACK_URL) {
      payload.callback_url = PAYSTACK_CALLBACK_URL.replace(/\/pricing-billing\/?$/, "/payment-success");
    }

    const res = await fetch(PAYSTACK_INIT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Paystack init error", data);
      return NextResponse.json({ error: "Failed to initialize payment" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error initializing paystack transaction:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

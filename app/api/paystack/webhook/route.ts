import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectToDatabase } from "@/lib/db";
import { Payment } from "@/lib/models/Payment";
import { User } from "@/lib/models/User";

// Paystack sends an HMAC sha512 signature in the `x-paystack-signature` header
export async function POST(req: NextRequest) {
  try {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    if (!PAYSTACK_SECRET_KEY) {
      console.error("Webhook received but PAYSTACK_SECRET_KEY not configured");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // Get raw body for signature verification
    const bodyText = await req.text();
    const signature = req.headers.get("x-paystack-signature") || req.headers.get("X-Paystack-Signature");

    if (!signature) {
      console.error("Missing x-paystack-signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const hmac = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(bodyText).digest("hex");

    if (hmac !== signature) {
      console.error("Invalid webhook signature", { expected: hmac, got: signature });
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(bodyText);

    const eventData = event?.data;

    if (!eventData) {
      return NextResponse.json({ ok: true });
    }

    // Only process successful transactions
    const status = eventData.status || eventData.transaction?.status;
    const reference = eventData.reference || eventData.transaction?.reference;
    const amount = eventData.amount || eventData.transaction?.amount || 0;
    const currency = eventData.currency || eventData.transaction?.currency || "USD";
    const metadata = eventData.metadata || eventData.transaction?.metadata || {};

    if (!reference) {
      console.error("Webhook event missing reference", event);
      return NextResponse.json({ ok: true });
    }

    await connectToDatabase();

    const existing = await Payment.findOne({ reference });

    if (existing && existing.processed) {
      // Already handled
      return NextResponse.json({ ok: true });
    }

    // Map auth0Sub or email from event (we recommend initialize sent auth0Sub in metadata)
    const metadataAuth0Id = metadata?.auth0Sub || eventData?.metadata?.auth0Sub || null;
    const email = eventData.customer?.email || eventData.customer_email || metadata?.email || null;

    if (String(status).toLowerCase() === "success") {
      // Credits from metadata
      const creditsToAdd = Number(metadata?.credits || eventData?.metadata?.credits || 0);

      // Create or update payment record
      if (existing) {
        existing.status = status;
        existing.raw = eventData;
        existing.amount = amount;
        existing.currency = currency;
        existing.credits = creditsToAdd;
        // we will mark processed only if we can find and credit a user
        await existing.save();
      } else {
        await Payment.create({
          reference,
          email,
          amount,
          currency,
          credits: creditsToAdd,
          status,
          processed: false,
          raw: eventData,
          auth0Sub: metadataAuth0Id || undefined,
        });
      }

      // Find user by auth0Sub first (if provided), otherwise by email
      let user = null;
      if (metadataAuth0Id) {
        user = await User.findOne({ auth0Sub: metadataAuth0Id });
      }
      if (!user && email) {
        user = await User.findOne({ email });
      }

      if (user && creditsToAdd > 0) {
        user.credits = (user.credits || 0) + creditsToAdd;
        await user.save();

        // Mark payment processed
        await Payment.findOneAndUpdate({ reference }, { processed: true, auth0Sub: user.auth0Sub, status, credits: creditsToAdd, amount, currency, raw: eventData });
      } else {
        // Save/update payment but leave processed=false so manual reconciliation is possible
        await Payment.findOneAndUpdate({ reference }, { status, credits: creditsToAdd, amount, currency, raw: eventData, auth0Sub: metadataAuth0Id || undefined }, { upsert: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error processing paystack webhook:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

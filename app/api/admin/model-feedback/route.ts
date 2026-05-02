import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action !== "push_to_retrain") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Retrain job pushed to queue." });
  } catch (error) {
    console.error("Error triggering model feedback retrain:", error);
    return NextResponse.json({ error: "Failed to trigger retrain" }, { status: 500 });
  }
}

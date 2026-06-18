import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action !== "trigger_run") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    // In a real app, this would enqueue a pipeline job and notify the ML service.
    return NextResponse.json({ success: true, message: "Pipeline run queued." });
  } catch (error) {
    console.error("Error triggering pipeline:", error);
    return NextResponse.json({ error: "Failed to trigger pipeline run" }, { status: 500 });
  }
}

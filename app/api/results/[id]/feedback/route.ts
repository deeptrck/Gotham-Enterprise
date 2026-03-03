import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getJobMeta,
  getJobFeedbackSummary,
  getUserJobFeedback,
  type FeedbackLabel,
  upsertJobFeedback,
} from "@/lib/fakecatcherStore";

type FeedbackBody = {
  label?: FeedbackLabel;
  comment?: string;
};

function isValidFeedbackLabel(value: unknown): value is FeedbackLabel {
  return value === "FALSE_POSITIVE" || value === "FALSE_NEGATIVE";
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const meta = getJobMeta(id);

    if (meta && meta.userId !== userId) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    const body = (await req.json()) as FeedbackBody;
    if (!isValidFeedbackLabel(body.label)) {
      return NextResponse.json(
        { error: "Invalid feedback label. Use FALSE_POSITIVE or FALSE_NEGATIVE." },
        { status: 400 }
      );
    }

    const trimmedComment = typeof body.comment === "string" ? body.comment.trim().slice(0, 500) : undefined;

    const feedback = upsertJobFeedback(id, {
      userId,
      label: body.label,
      comment: trimmedComment,
    });

    return NextResponse.json(
      {
        success: true,
        feedback,
        summary: getJobFeedbackSummary(id),
        userFeedback: getUserJobFeedback(id, userId),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error submitting result feedback:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

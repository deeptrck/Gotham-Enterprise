import { NextResponse } from "next/server";
import { auth, getOrganizationId } from "@/lib/auth";
import { findVerificationResult } from "@/lib/repositories/verificationResults";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const { userId, user } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = getOrganizationId(user);
    if (!organizationId) return NextResponse.json({ error: "Organization context required" }, { status: 403 });

    const result = await findVerificationResult({
      scope: { organizationId, actorUserId: userId },
      id,
      userId,
    });
    if (!result) return NextResponse.json({ error: "Result not found" }, { status: 404 });

    return NextResponse.json({
      _id: result.id,
      scanId: result.scan_id,
      fileName: result.file_name,
      fileType: result.file_type,
      status: result.status,
      confidenceScore: result.confidence_score,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      uploadedAt: result.uploaded_at,
      imageUrl: result.image_url || "",
      sourceUrl: result.source_url || "",
      description: result.description || "",
      modelsUsed: result.models_used || [],
      features: result.features || [],
      proprietaryAnalysis: result.proprietary_analysis || null,
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching PostgreSQL verification result:", error);
    return NextResponse.json({ error: "Result service unavailable" }, { status: 503 });
  }
}

export async function DELETE() {
  return NextResponse.json({ error: "Result deletion is not supported" }, { status: 405 });
}

import { NextRequest, NextResponse } from "next/server";
import { auth, getOrganizationId } from "@/lib/auth";
import { listVerificationResults } from "@/lib/repositories/verificationResults";



export async function GET(req: NextRequest) {
  try {
    const { userId, user } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrganizationId(user);
    if (!organizationId) return NextResponse.json({ error: "Organization context required" }, { status: 403 });
    const url = new URL(req.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    let results;
    try {
      results = await listVerificationResults({ scope: { organizationId, actorUserId: userId }, userId, limit, offset: (page - 1) * limit });
    } catch (dbErr) {
      console.error("PostgreSQL results unavailable:", dbErr);
      return NextResponse.json({ error: "Results service unavailable" }, { status: 503 });
    }
    const total = results.total;
    const pages = total > 0 ? Math.ceil(total / limit) : 0;
    const entries = results.rows.map((result) => ({
      _id: result.id,
      scanId: result.scan_id,
      fileName: result.file_name,
      status: result.status,
      confidenceScore: result.confidence_score,
      createdAt: result.created_at,
      fileType: result.file_type,
      imageUrl: result.image_url || "",
      description: result.description || "",
      modelsUsed: result.models_used || [],
      features: result.features || [],
    }));

    return NextResponse.json(
      {
        success: true,
        data: entries,
        pagination: {
          page,
          limit,
          total,
          pages,
          hasNextPage: page < pages,
          hasPrevPage: page > 1,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching results:", error);
    return NextResponse.json({ error: "Results service unavailable" }, { status: 503 });
  }
}

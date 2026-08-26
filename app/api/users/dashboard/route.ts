import { NextRequest, NextResponse } from "next/server";
import { auth, getOrganizationId } from "@/lib/auth";
import { findUserForOrganization } from "@/lib/repositories/users";
import { listVerificationResults } from "@/lib/repositories/verificationResults";
import * as Sentry from "@sentry/nextjs";

// Type for a single scan summary returned to the frontend
type ScanSummary = {
  _id: string;
  scanId: string;
  fileName: string;
  status: string;
  confidenceScore: number;
  createdAt: string;
  fileType?: string;
  imageUrl?: string;
};

function serializeResult(result: Awaited<ReturnType<typeof listVerificationResults>>["rows"][number]): ScanSummary {
  return {
    _id: result.id,
    scanId: result.scan_id,
    fileName: result.file_name,
    status: result.status,
    confidenceScore: result.confidence_score,
    createdAt: result.created_at,
    fileType: result.file_type,
    imageUrl: result.image_url ?? undefined,
  };
}

export async function GET(req: NextRequest) {
  const reqId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  console.time(`dashboard:${reqId}:total`);

  try {
    const { userId, user } = await auth();

    if (!userId) {
      console.timeEnd(`dashboard:${reqId}:total`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = getOrganizationId(user);
    if (!organizationId) return NextResponse.json({ error: "Organization context required" }, { status: 403 });
    const url = new URL(req.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
    const [account, results] = await Promise.all([
      findUserForOrganization({ organizationId, actorUserId: userId }, userId),
      listVerificationResults({ scope: { organizationId, actorUserId: userId }, userId, limit, offset: (page - 1) * limit }),
    ]);
    if (!account) return NextResponse.json({ error: "User is not assigned to this organization" }, { status: 403 });
    const responseData = {
      credits: account.credits,
      scans: results.rows.map(serializeResult),
      page,
      limit,
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error(`Error fetching dashboard data [${reqId}]:`, error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error", requestId: reqId }, { status: 500 });
  }
}

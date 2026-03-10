import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getJobMeta, getJobRdAnalysis, listUserJobMeta } from "@/lib/fakecatcherStore";

const BACKEND_API_URL = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://facedetectionsystem.onrender.com"
).replace(/\/$/, "");
const BACKEND_REQUEST_TIMEOUT_MS = Math.max(
  5000,
  parseInt(process.env.BACKEND_REQUEST_TIMEOUT_MS || "90000", 10)
);

function buildBackendUrl(path: string) {
  return `${BACKEND_API_URL}${path}`;
}

function mapJobStatus(status?: string) {
  if (status === "done") return "AUTHENTIC";
  if (status === "error") return "DEEPFAKE";
  return "PROCESSING";
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mapRdToManipulationScore(status?: string, score?: number) {
  const normalized = clamp01(typeof score === "number" ? score : 0);
  if (status === "AUTHENTIC") return 1 - normalized;
  if (status === "MANIPULATED") return normalized;
  return 0.5;
}

function mapCombinedStatus(score: number) {
  if (score >= 0.65) return "DEEPFAKE";
  if (score <= 0.35) return "AUTHENTIC";
  return "SUSPICIOUS";
}

function mapBackendFetchError(error: unknown) {
  const err = error as { message?: string; cause?: { code?: string } };
  const causeCode = err.cause?.code;
  const timeoutLike =
    causeCode === "UND_ERR_HEADERS_TIMEOUT" ||
    causeCode === "UND_ERR_CONNECT_TIMEOUT" ||
    causeCode === "ABORT_ERR";

  return timeoutLike
    ? `Backend request timed out after ${Math.round(BACKEND_REQUEST_TIMEOUT_MS / 1000)}s`
    : `Failed to reach backend: ${err.message || "network error"}`;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") || "20", 10)));

    // Skip backend call for faster loading, use only cached RD-only results
    const rdOnlyEntries = listUserJobMeta(userId)
      .filter((meta) => meta.source === "rd-only")
      .map((meta) => {
        const rd = getJobRdAnalysis(meta.jobId);
        const score = mapRdToManipulationScore(rd?.status, rd?.score);
        const status = mapCombinedStatus(score);
        const confidence = Math.round(clamp01(score) * 1000) / 10;
        const rdModelNames = (rd?.models || []).map((m) => m.name || "rd-model");

        return {
          _id: meta.jobId,
          scanId: meta.jobId,
          fileName: meta.fileName,
          status,
          confidenceScore: confidence,
          createdAt: meta.createdAt,
          fileType: meta.fileType,
          imageUrl: meta.imageData || "",
          description: JSON.stringify({
            rd: {
              source: "reality-defender",
              jobStatus: "done",
            },
          }),
          modelsUsed: rdModelNames,
          features: [
            "source:reality-defender",
            rd ? `rd_status:${rd.status}` : "rd_status:unavailable",
          ],
        };
      });

    const entries = rdOnlyEntries;

    entries.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    const total = entries.length;
    const pages = total > 0 ? Math.ceil(total / limit) : 0;
    const start = (page - 1) * limit;
    const data = entries.slice(start, start + limit);

    return NextResponse.json(
      {
        success: true,
        data,
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
    return NextResponse.json(
      {
        success: true,
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          pages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
      { status: 200 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getJobMeta, getJobRdAnalysis, listUserJobMeta } from "@/lib/fakecatcherStore";
import { connectToDatabase } from "@/lib/db";
import { VerificationResult } from "@/lib/models/VerificationResult";

const BACKEND_API_URL = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://facedetectionsystem.onrender.com"
).replace(/\/$/, "");
const BACKEND_REQUEST_TIMEOUT_MS = Math.max(
  5000,
  parseInt(process.env.BACKEND_REQUEST_TIMEOUT_MS || "90000", 10)
);

// Note: removed transient timeout wrapper to restore original DB behaviour

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

function mapRdStatusToResultStatus(status?: string) {
  if (status === "MANIPULATED") return "DEEPFAKE";
  if (status === "AUTHENTIC") return "AUTHENTIC";
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

    const maxResultsEntries = 200;
    const rdOnlyEntries = listUserJobMeta(userId)
      .filter((meta) => meta.source === "rd-only")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, maxResultsEntries)
      .map((meta) => {
        const rd = getJobRdAnalysis(meta.jobId);
        const score = mapRdToManipulationScore(rd?.status, rd?.score);
        const status = rd?.status === "MANIPULATED"
          ? "DEEPFAKE"
          : rd?.status === "AUTHENTIC"
          ? "AUTHENTIC"
          : mapCombinedStatus(score);
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

    // Merge DB-backed verification results with rd-only cached entries efficiently
    let entries: any[] = [];
    let total = 0;
    let pages = 0;

    try {
      await connectToDatabase();

      // Count DB entries and fetch the top `page * limit` to allow merging without pulling entire collection
      const fetchLimit = Math.max(limit * page, limit);
      const dbCount = await VerificationResult.countDocuments({ userId }).maxTimeMS(3000).exec();
      const dbTop = await VerificationResult.find({ userId })
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .hint({ userId: 1, createdAt: -1 })
        .maxTimeMS(3000)
        .lean();

      const dbEntries = (dbTop || []).map((d: any) => ({
        _id: d._id,
        scanId: d.scanId || d._id,
        fileName: d.fileName,
        status: d.status,
        confidenceScore: d.confidenceScore,
        createdAt: d.createdAt || d.createdAt,
        fileType: d.fileType,
        imageUrl: d.imageUrl || "",
        description: d.description || "",
        modelsUsed: d.modelsUsed || [],
        features: d.features || [],
      }));

      const dbScanIds = new Set(dbEntries.map((d) => String(d.scanId)));

      // Take top RD-only entries up to fetchLimit, excluding those present in DB
      const rdTop = rdOnlyEntries
        .filter((e) => !dbScanIds.has(String(e.scanId)))
        .slice(0, fetchLimit);

      // Merge and sort by createdAt
      const combined = [...dbEntries, ...rdTop].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

      // Compute total as dbCount + number of rdOnly entries not present in DB
      const rdOnlyUniqueCount = rdOnlyEntries.filter((e) => !dbScanIds.has(String(e.scanId))).length;
      total = dbCount + rdOnlyUniqueCount;
      pages = total > 0 ? Math.ceil(total / limit) : 0;

      const start = (page - 1) * limit;
      entries = combined.slice(start, start + limit);
    } catch (dbErr) {
      // If DB is unavailable, fallback to RD-only cached entries (fast)
      entries = rdOnlyEntries.slice((page - 1) * limit, page * limit);
      total = rdOnlyEntries.length;
      pages = total > 0 ? Math.ceil(total / limit) : 0;
    }

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

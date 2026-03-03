import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getJobMeta } from "@/lib/fakecatcherStore";

const BACKEND_API_URL = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://facedetectionsystem.onrender.com"
).replace(/\/$/, "");

function buildBackendUrl(path: string) {
  return `${BACKEND_API_URL}${path}`;
}

function mapJobStatus(status?: string) {
  if (status === "done") return "AUTHENTIC";
  if (status === "error") return "DEEPFAKE";
  return "PROCESSING";
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

    const response = await fetch(buildBackendUrl("/jobs"), {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = await response.text();
      return new NextResponse(payload, {
        status: response.status,
        headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
      });
    }

    const payload = (await response.json()) as {
      jobs?: Record<string, { status?: string; filename?: string; age_sec?: number }>;
    };

    const entries = Object.entries(payload.jobs || {}).map(([jobId, job]) => {
      const meta = getJobMeta(jobId);
      return {
        _id: jobId,
        scanId: jobId,
        fileName: meta?.fileName || job.filename || `video-${jobId}`,
        status: mapJobStatus(job.status),
        confidenceScore: 0,
        createdAt: meta?.createdAt || new Date(Date.now() - ((job.age_sec || 0) * 1000)).toISOString(),
        fileType: "video",
        imageUrl: "",
        description: JSON.stringify({ rd: { source: "fakecatcher", jobStatus: job.status } }),
        modelsUsed: ["fakecatcher-rppg"],
        features: [
          `job_status:${job.status || "queued"}`,
        ],
      };
    }).filter((row) => {
      const meta = getJobMeta(row.scanId);
      return !meta || meta.userId === userId;
    });

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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

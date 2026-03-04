import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getJobFeedbackSummary, getJobMeta, getJobRdAnalysis, getUserJobFeedback } from "@/lib/fakecatcherStore";

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

type FakeCatcherJobResult = {
  label?: "REAL" | "FAKE" | "UNCERTAIN" | string;
  confidence?: number;
  fake_prob?: number;
  total_frames?: number;
  face_pct?: number;
  n_segments?: number;
};

type FakeCatcherJobResponse = {
  job_id: string;
  status: "queued" | "processing" | "done" | "error";
  filename?: string;
  age_sec?: number;
  result?: FakeCatcherJobResult;
  error?: string | null;
};

function mapJobToStatus(label?: string) {
  if (label === "REAL") return "AUTHENTIC";
  if (label === "FAKE") return "DEEPFAKE";
  return "SUSPICIOUS";
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mapRdModelStatus(status?: string) {
  if (status === "MANIPULATED") return "MANIPULATED";
  if (status === "AUTHENTIC") return "AUTHENTIC";
  return "SUSPICIOUS";
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

  return {
    timeoutLike,
    message: timeoutLike
      ? `Backend request timed out after ${Math.round(BACKEND_REQUEST_TIMEOUT_MS / 1000)}s`
      : `Failed to reach backend: ${err.message || "network error"}`,
    status: timeoutLike ? 504 : 502,
  };
}

function buildRdOnlyPayload(id: string, fileName: string, fileType: "image" | "video" | "audio", createdAt: string) {
  const rd = getJobRdAnalysis(id);
  const rdUsable = Boolean(
    rd &&
    rd.status !== "ERROR" &&
    rd.status !== "DISABLED"
  );

  const rdScore = rdUsable && rd ? mapRdToManipulationScore(rd.status, rd.score) : 0.5;
  const combinedScore = clamp01(rdScore);
  const combinedStatus = mapCombinedStatus(combinedScore);

  const allModels = (rd?.models || []).map((m) => ({
    name: m.name || "rd-model",
    status: mapRdModelStatus(m.status),
    score: clamp01(m.score),
  }));

  const description = JSON.stringify({
    rd: {
      source: "reality-defender",
      jobStatus: "done",
      models: allModels,
      fakecatcher: null,
      realityDefender: rd || null,
      fusion: {
        score: combinedScore,
        status: combinedStatus,
        weights: { fakecatcher: 0, realityDefender: 1 },
      },
    },
  });

  return {
    fileName,
    scanId: id,
    fileType,
    status: combinedStatus,
    confidenceScore: Math.round(combinedScore * 1000) / 10,
    createdAt,
    imageUrl: "",
    modelsUsed: allModels.map((m) => m.name),
    description,
    features: [
      "source:reality-defender",
      rd ? `rd_status:${rd.status}` : "rd_status:unavailable",
      `fusion_score:${combinedScore.toFixed(4)}`,
    ],
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const meta = getJobMeta(id);
    if (meta && meta.userId !== userId) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    const shouldUseRdOnly = meta?.source === "rd-only" || id.startsWith("rd-");

    if (shouldUseRdOnly) {
      const responsePayload = buildRdOnlyPayload(
        id,
        meta?.fileName || `media-${id}`,
        meta?.fileType || "image",
        meta?.createdAt || new Date().toISOString()
      );
      const feedbackSummary = getJobFeedbackSummary(id);
      const userFeedback = getUserJobFeedback(id, userId);

      return NextResponse.json(
        {
          ...responsePayload,
          feedbackSummary,
          userFeedback,
        },
        { status: 200 }
      );
    }

    let response: Response;
    try {
      response = await fetch(buildBackendUrl(`/jobs/${id}`), {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(BACKEND_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const mapped = mapBackendFetchError(error);
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    if (!response.ok) {
      const payload = await response.text();
      return new NextResponse(payload, {
        status: response.status,
        headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
      });
    }

    const job = (await response.json()) as FakeCatcherJobResponse;

        const label = job.result?.label;
        const fakeProb = typeof job.result?.fake_prob === "number" ? job.result.fake_prob : 0;
        const modelScore = label === "REAL" ? 1 - fakeProb : label === "FAKE" ? fakeProb : 0.5;
        const modelStatus = label === "REAL" ? "AUTHENTIC" : label === "FAKE" ? "MANIPULATED" : "SUSPICIOUS";
        const rd = getJobRdAnalysis(id);
        const rdUsable = Boolean(
          rd &&
          rd.status !== "ERROR" &&
          rd.status !== "DISABLED"
        );

        const rdScore = rdUsable && rd ? mapRdToManipulationScore(rd.status, rd.score) : null;
        const combinedScore = rdScore === null
          ? clamp01(modelScore)
          : clamp01(modelScore * 0.6 + rdScore * 0.4);
        const combinedStatus = mapCombinedStatus(combinedScore);

        const allModels = [
          {
            name: "fakecatcher-rppg",
            status: modelStatus,
            score: clamp01(modelScore),
          },
          ...((rd?.models || []).map((m) => ({
            name: m.name || "rd-model",
            status: mapRdModelStatus(m.status),
            score: clamp01(m.score),
          }))),
        ];

        const description = JSON.stringify({
          rd: {
            source: rd ? "fakecatcher+reality-defender" : "fakecatcher",
            jobStatus: job.status,
            models: allModels,
            fakecatcher: {
              label: label || "UNCERTAIN",
              fake_prob: clamp01(fakeProb),
              confidence:
                typeof job.result?.confidence === "number"
                  ? job.result.confidence
                  : Math.round(clamp01(modelScore) * 1000) / 10,
            },
            realityDefender: rd || null,
            fusion: {
              score: combinedScore,
              status: combinedStatus,
              weights: rdUsable
                ? { fakecatcher: 0.6, realityDefender: 0.4 }
                : { fakecatcher: 1, realityDefender: 0 },
            },
          },
        });

        const createdAt = meta?.createdAt || new Date(Date.now() - ((job.age_sec || 0) * 1000)).toISOString();

    const responsePayload = {
      fileName: meta?.fileName || job.filename || `video-${id}`,
      scanId: id,
      fileType: meta?.fileType || "video",
      status: rdUsable ? combinedStatus : mapJobToStatus(label),
      confidenceScore: Math.round(combinedScore * 1000) / 10,
      createdAt,
      imageUrl: "",
      modelsUsed: allModels.map((m) => m.name),
      description,
      features: [
        `job_status:${job.status}`,
        `fake_prob:${fakeProb}`,
        `label:${label || "UNCERTAIN"}`,
        rd ? `rd_status:${rd.status}` : "rd_status:unavailable",
        rdUsable ? "rd_used:true" : "rd_used:false",
        `fusion_score:${combinedScore.toFixed(4)}`,
      ],
    };

    const feedbackSummary = getJobFeedbackSummary(id);
    const userFeedback = getUserJobFeedback(id, userId);

    return NextResponse.json(
      {
        ...responsePayload,
        feedbackSummary,
        userFeedback,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching result:", error);
    const mapped = mapBackendFetchError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Delete is not supported with FakeCatcher job-backed results." },
    { status: 405 }
  );
}

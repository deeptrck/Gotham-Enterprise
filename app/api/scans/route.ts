import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getJobMeta, setJobMeta, setJobRdAnalysis } from "@/lib/fakecatcherStore";
import { verifyMedia } from "@/lib/realityDefender";

const BACKEND_API_URL = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://facedetectionsystem.onrender.com"
).replace(/\/$/, "");

function buildBackendUrl(path: string) {
  return `${BACKEND_API_URL}${path}`;
}

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ACCEPTED_VIDEO_EXT = [".mp4", ".avi", ".mov", ".mkv"];

function hasAcceptedVideoExtension(name: string) {
  const lower = name.toLowerCase();
  return ACCEPTED_VIDEO_EXT.some((ext) => lower.endsWith(ext));
}

function parseBackendError(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { error?: string; detail?: string; message?: string };
    return parsed.error || parsed.detail || parsed.message || raw;
  } catch {
    return raw || "Backend error";
  }
}

async function postVideoWithRetry(payload: FormData, attempts = 2) {
  let lastStatus = 503;
  let lastBody = "";
  let lastContentType = "application/json";

  for (let i = 0; i < attempts; i++) {
    const response = await fetch(buildBackendUrl("/predict/video"), {
      method: "POST",
      body: payload,
      cache: "no-store",
    });

    const responseBody = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";

    if (response.ok) {
      return { ok: true as const, status: response.status, body: responseBody, contentType };
    }

    lastStatus = response.status;
    lastBody = responseBody;
    lastContentType = contentType;

    const isTransient = response.status === 503 || response.status === 429;
    if (!isTransient || i === attempts - 1) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 1200 * (i + 1)));
  }

  return { ok: false as const, status: lastStatus, body: lastBody, contentType: lastContentType };
}

function getForwardHeaders(req: NextRequest) {
  const contentType = req.headers.get("content-type");
  const authorization = req.headers.get("authorization");

  return {
    ...(contentType ? { "Content-Type": contentType } : {}),
    ...(authorization ? { Authorization: authorization } : {}),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(buildBackendUrl("/jobs"), {
      method: "GET",
      headers: getForwardHeaders(req),
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = await response.text();
      return new NextResponse(payload, {
        status: response.status,
        headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
      });
    }

    const jobsPayload = await response.json() as { jobs?: Record<string, { status?: string; filename?: string; age_sec?: number }> };
    const jobs = jobsPayload.jobs || {};

    const scans = Object.entries(jobs).map(([jobId, job]) => {
      const meta = getJobMeta(jobId);
      const mappedStatus = job.status === "done"
        ? "AUTHENTIC"
        : job.status === "error"
        ? "DEEPFAKE"
        : "PROCESSING";

      return {
        _id: jobId,
        scanId: jobId,
        fileName: meta?.fileName || job.filename || `video-${jobId}`,
        fileType: "video",
        status: mappedStatus,
        confidenceScore: 0,
        createdAt: meta?.createdAt || new Date(Date.now() - ((job.age_sec || 0) * 1000)).toISOString(),
        imageUrl: "",
      };
    }).filter((item) => {
      const meta = getJobMeta(item.scanId);
      return !meta || meta.userId === userId;
    });

    return NextResponse.json(scans, { status: 200 });
  } catch (error) {
    console.error("Error proxying scans GET request:", error);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let videoFile: File | null = null;
    let fileName = "video-upload.mp4";

    if (contentType.includes("multipart/form-data")) {
      const incoming = await req.formData();
      const maybeFile = incoming.get("file");
      if (maybeFile instanceof File) {
        videoFile = maybeFile;
        fileName = maybeFile.name || fileName;
      }
    } else {
      const body = await req.json() as { base64?: string; fileName?: string; fileType?: string; url?: string };

      if (body.fileType && body.fileType !== "video") {
        return NextResponse.json({ error: "FakeCatcher currently supports video upload flow only." }, { status: 400 });
      }

      if (body.url) {
        return NextResponse.json({ error: "URL scanning is not supported by FakeCatcher. Upload a video file instead." }, { status: 400 });
      }

      if (!body.base64) {
        return NextResponse.json({ error: "Missing video payload" }, { status: 400 });
      }

      fileName = body.fileName || fileName;
      const safeName = fileName.toLowerCase();
      if (!safeName.endsWith(".mp4") && !safeName.endsWith(".avi") && !safeName.endsWith(".mov") && !safeName.endsWith(".mkv")) {
        return NextResponse.json({ error: "Unsupported format. Use: .mp4, .avi, .mov, .mkv" }, { status: 400 });
      }

      const buffer = Buffer.from(body.base64.replace(/^data:.+;base64,/, ""), "base64");
      videoFile = new File([buffer], fileName, { type: "video/mp4" });
    }

    if (!videoFile) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }

    if (!hasAcceptedVideoExtension(fileName)) {
      return NextResponse.json(
        { error: "Unsupported format. Use: .mp4, .avi, .mov, .mkv" },
        { status: 400 }
      );
    }

    if (videoFile.size > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { error: "Video exceeds 50 MB limit" },
        { status: 413 }
      );
    }

    const payload = new FormData();
    payload.append("file", videoFile);

    const shouldRunRD = Boolean(process.env.REALITY_DEFENDER_API_KEY);

    let rdOutcome:
      | {
          status: string;
          score: number;
          requestId?: string;
          models: Array<{ name: string; status: string; score: number }>;
          error?: string;
        }
      | undefined;

    if (shouldRunRD) {
      try {
        const arrayBuffer = await videoFile.arrayBuffer();
        const rd = await verifyMedia({
          fileBuffer: Buffer.from(arrayBuffer),
          fileType: "video",
        });

        rdOutcome = {
          requestId: rd.requestId,
          status: rd.status,
          score: Math.max(0, Math.min(1, rd.score || 0)),
          models: (rd.models || []).map((model) => ({
            name: model.name || "rd-model",
            status: model.status || "UNKNOWN",
            score: Math.max(0, Math.min(1, Number(model.score) || 0)),
          })),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Reality Defender verification failed";
        rdOutcome = {
          status: "ERROR",
          score: 0,
          models: [],
          error: message,
        };
        console.warn("Reality Defender scan failed; continuing with FakeCatcher:", message);
      }
    }

    const submit = await postVideoWithRetry(payload, 2);
    if (!submit.ok) {
      return NextResponse.json(
        { error: parseBackendError(submit.body) },
        { status: submit.status }
      );
    }

    const parsed = JSON.parse(submit.body) as { job_id: string; status?: string; filename?: string };
    setJobMeta(parsed.job_id, {
      userId,
      fileName: parsed.filename || fileName,
      fileType: "video",
      createdAt: new Date().toISOString(),
    });

    if (rdOutcome) {
      setJobRdAnalysis(parsed.job_id, {
        ...rdOutcome,
        analyzedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        scanId: parsed.job_id,
        status: parsed.status || "queued",
        fileName: parsed.filename || fileName,
        fileType: "video",
        dualModel: rdOutcome
          ? {
              fakecatcher: true,
              realityDefender: rdOutcome.status !== "ERROR",
            }
          : {
              fakecatcher: true,
              realityDefender: false,
            },
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error proxying scans POST request:", error);
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}

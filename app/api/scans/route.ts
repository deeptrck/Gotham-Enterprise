import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getJobMeta, getJobFakeCatcherAnalysis, listUserJobMeta, setJobMeta, setJobFakeCatcherAnalysis } from "@/lib/fakecatcherStore";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { VerificationResult } from "@/lib/models/VerificationResult";

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
const ACCEPTED_IMAGE_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
const ACCEPTED_AUDIO_EXT = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"];
const BACKEND_REQUEST_TIMEOUT_MS = Math.max(
  5000,
  parseInt(process.env.BACKEND_REQUEST_TIMEOUT_MS || "90000", 10)
);
const CREDIT_COST_PER_SCAN = 1;

function hasAcceptedVideoExtension(name: string) {
  const lower = name.toLowerCase();
  return ACCEPTED_VIDEO_EXT.some((ext) => lower.endsWith(ext));
}

function hasAcceptedImageExtension(name: string) {
  const lower = name.toLowerCase();
  return ACCEPTED_IMAGE_EXT.some((ext) => lower.endsWith(ext));
}

function hasAcceptedAudioExtension(name: string) {
  const lower = name.toLowerCase();
  return ACCEPTED_AUDIO_EXT.some((ext) => lower.endsWith(ext));
}

function inferFileType(fileName: string, mimeType?: string): "image" | "video" | "audio" | null {
  const mime = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();

  if (mime.startsWith("video/") || hasAcceptedVideoExtension(name)) return "video";
  if (mime.startsWith("image/") || hasAcceptedImageExtension(name)) return "image";
  if (mime.startsWith("audio/") || hasAcceptedAudioExtension(name)) return "audio";
  return null;
}

function mapRdModelStatus(status?: string) {
  if (status === "MANIPULATED") return "MANIPULATED";
  if (status === "AUTHENTIC") return "AUTHENTIC";
  return "SUSPICIOUS";
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

function parseBackendError(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { error?: string; detail?: string; message?: string };
    return parsed.error || parsed.detail || parsed.message || raw;
  } catch {
    return raw || "Backend error";
  }
}

async function consumeUserCredit(userId: string) {
  await connectToDatabase();

  const updatedUser = await User.findOneAndUpdate(
    { clerkId: userId, credits: { $gte: CREDIT_COST_PER_SCAN } },
    { $inc: { credits: -CREDIT_COST_PER_SCAN } },
    { new: true }
  ).select("credits");

  if (updatedUser) {
    return { ok: true as const };
  }

  const existingUser = await User.findOne({ clerkId: userId }).select("_id");
  if (!existingUser) {
    return { ok: false as const, reason: "USER_NOT_FOUND" as const };
  }

  return { ok: false as const, reason: "INSUFFICIENT_CREDITS" as const };
}

async function refundUserCredit(userId: string) {
  await connectToDatabase();
  await User.updateOne(
    { clerkId: userId },
    { $inc: { credits: CREDIT_COST_PER_SCAN } }
  );
}

async function postVideoWithRetry(payload: FormData, attempts = 2) {
  let lastStatus = 503;
  let lastBody = "";
  let lastContentType = "application/json";

  for (let i = 0; i < attempts; i++) {
    let response: Response;

    try {
      response = await fetch(buildBackendUrl("/v1/video/predict/video"), {
        method: "POST",
        body: payload,
        cache: "no-store",
        signal: AbortSignal.timeout(BACKEND_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const err = error as { message?: string; cause?: { code?: string } };
      const causeCode = err.cause?.code;
      const timeoutLike =
        causeCode === "UND_ERR_HEADERS_TIMEOUT" ||
        causeCode === "UND_ERR_CONNECT_TIMEOUT" ||
        causeCode === "ABORT_ERR";

      lastStatus = timeoutLike ? 504 : 502;
      lastBody = timeoutLike
        ? `Backend request timed out after ${Math.round(BACKEND_REQUEST_TIMEOUT_MS / 1000)}s while calling ${buildBackendUrl("/v1/video/predict/video")}.`
        : `Failed to reach backend ${buildBackendUrl("/v1/video/predict/video")}: ${err.message || "network error"}`;
      lastContentType = "application/json";

      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * (i + 1)));
        continue;
      }

      break;
    }

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

async function postImageToFakeCatcher(payload: FormData) {
  try {
    const response = await fetch(buildBackendUrl("/v1/image/predict"), {
      method: "POST",
      body: payload,
      cache: "no-store",
      signal: AbortSignal.timeout(BACKEND_REQUEST_TIMEOUT_MS),
    });

    const responseBody = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";

    if (response.ok) {
      return { ok: true as const, body: responseBody, contentType };
    }

    return { ok: false as const, body: responseBody, contentType };
  } catch (error) {
    const err = error as { message?: string; cause?: { code?: string } };
    return { ok: false as const, body: err.message || "Image prediction failed", contentType: "application/json" };
  }
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

    let jobsPayload: { jobs?: Record<string, { status?: string; filename?: string; age_sec?: number }> } = { jobs: {} };
    let degraded: string | null = null;

    try {
      const response = await fetch(buildBackendUrl("/jobs"), {
        method: "GET",
        headers: getForwardHeaders(req),
        cache: "no-store",
        signal: AbortSignal.timeout(5000), // Short timeout for fast loading
      });

      if (!response.ok) {
        // Backend unavailable, but we have cached RD-only scans - no need for error message
      } else {
        jobsPayload = await response.json() as { jobs?: Record<string, { status?: string; filename?: string; age_sec?: number }> };
      }
    } catch (error) {
      // Backend unavailable, but we have cached RD-only scans - continue without error message
    }

    const jobs = jobsPayload.jobs || {};

    const backendScans = Object.entries(jobs).map(([jobId, job]) => {
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
        imageUrl: meta?.imageData || "",
      };
    }).filter((item) => {
      const meta = getJobMeta(item.scanId);
      return !meta || meta.userId === userId;
    });

    const rdOnlyScans = listUserJobMeta(userId)
      .filter((meta) => meta.source === "fakecatcher")
      .map((meta) => {
        const fc = getJobFakeCatcherAnalysis(meta.jobId);
        let status = "SUSPICIOUS";
        let confidenceScore = 50;
        if (fc?.label) {
          status = fc.label === "FAKE" ? "DEEPFAKE" : fc.label === "REAL" ? "AUTHENTIC" : "SUSPICIOUS";
          confidenceScore = fc.confidence ? Math.round(fc.confidence * 10) / 10 : 50;
        }

        return {
          _id: meta.jobId,
          scanId: meta.jobId,
          fileName: meta.fileName,
          fileType: meta.fileType,
          status,
          confidenceScore,
          createdAt: meta.createdAt,
          imageUrl: meta.imageData || "",
        };
      });

    const scans = [...backendScans, ...rdOnlyScans].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
    );

    return NextResponse.json(
      degraded
        ? { scans, degraded }
        : scans,
      { status: 200 }
    );
  } catch (error) {
    console.error("Error proxying scans GET request:", error);
    return NextResponse.json(
      {
        scans: [],
        degraded: "Scan telemetry is temporarily unavailable.",
      },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  let chargedUserId: string | null = null;
  let imageData: string | undefined;
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    let uploadedFile: File | null = null;
    let fileName = "media-upload";
    let requestedFileType: "image" | "video" | "audio" | null = null;
    let urlInput: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const incoming = await req.formData();
      const maybeFile = incoming.get("file");
      if (maybeFile instanceof File) {
        uploadedFile = maybeFile;
        fileName = maybeFile.name || fileName;
        requestedFileType = inferFileType(fileName, maybeFile.type);
      }
    } else {
      const body = await req.json() as { base64?: string; fileName?: string; fileType?: string; url?: string };

      if (body.fileType && ["image", "video", "audio"].includes(body.fileType)) {
        requestedFileType = body.fileType as "image" | "video" | "audio";
      }

      if (body.url) {
        urlInput = body.url;
        fileName = body.fileName || new URL(body.url).pathname.split("/").pop() || fileName;
        requestedFileType = requestedFileType || inferFileType(fileName);
      } else {
        if (!body.base64) {
          return NextResponse.json({ error: "Missing media payload" }, { status: 400 });
        }

        fileName = body.fileName || fileName;
        imageData = body.base64;
        requestedFileType = requestedFileType || inferFileType(fileName);
        const mimeType = requestedFileType === "video"
          ? "video/mp4"
          : requestedFileType === "audio"
          ? "audio/mpeg"
          : "image/png";
        const buffer = Buffer.from(body.base64.replace(/^data:.+;base64,/, ""), "base64");
        uploadedFile = new File([buffer], fileName, { type: mimeType });
      }
    }

    const fileType = requestedFileType || inferFileType(fileName, uploadedFile?.type);

    if (!fileType) {
      return NextResponse.json(
        { error: "Unsupported format. Use: images (.jpg, .png), audio (.mp3, .wav), or video (.mp4, .avi, .mov, .mkv)." },
        { status: 400 }
      );
    }

    if (fileType === "video" && !hasAcceptedVideoExtension(fileName)) {
      return NextResponse.json(
        { error: "Unsupported format. Use: .mp4, .avi, .mov, .mkv" },
        { status: 400 }
      );
    }

    if (fileType === "image" && !hasAcceptedImageExtension(fileName)) {
      return NextResponse.json(
        { error: "Unsupported image format. Use: .jpg, .jpeg, .png, .gif, .webp, .bmp" },
        { status: 400 }
      );
    }

    if (fileType === "audio" && !hasAcceptedAudioExtension(fileName)) {
      return NextResponse.json(
        { error: "Unsupported audio format. Use: .mp3, .wav, .ogg, .m4a, .aac, .flac" },
        { status: 400 }
      );
    }

    if (uploadedFile && fileType === "video" && uploadedFile.size > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { error: "Video exceeds 50 MB limit" },
        { status: 413 }
      );
    }

    const chargeResult = await consumeUserCredit(userId);
    if (!chargeResult.ok) {
      if (chargeResult.reason === "USER_NOT_FOUND") {
        return NextResponse.json(
          { error: "User profile not found. Please refresh and try again." },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "Insufficient credits. Please top up to continue scanning." },
        { status: 402 }
      );
    }
    chargedUserId = userId;

    let rdOutcome = {
      status: "DISABLED",
      score: 0,
      models: [] as Array<{ name: string; status: string; score: number }>,
      error: "Reality Defender is disabled",
    };

    let fcOutcome: { label?: string; confidence?: number; fake_prob?: number } | undefined;

    if (fileType === "image" && uploadedFile) {
      if (!imageData) {
        try {
          const arr = await uploadedFile.arrayBuffer();
          const b64 = Buffer.from(arr).toString("base64");
          if (uploadedFile.type) {
            imageData = `data:${uploadedFile.type};base64,${b64}`;
          } else {
            imageData = `data:image/png;base64,${b64}`;
          }
        } catch (e) {
          console.warn("Failed to generate image preview data URL:", e);
        }
      }

      const payload = new FormData();
      payload.append("file", uploadedFile);

      const imageResult = await postImageToFakeCatcher(payload);
      if (imageResult.ok) {
        try {
          const parsed = JSON.parse(imageResult.body) as {
            prediction?: string;
            confidence_percentage?: number;
            raw_scores?: { Real?: number; Fake?: number };
          };
          fcOutcome = {
            label: parsed.prediction === "Fake" ? "FAKE" : parsed.prediction === "Real" ? "REAL" : undefined,
            confidence: parsed.confidence_percentage,
            fake_prob: parsed.raw_scores?.Fake ? parsed.raw_scores.Fake / 100 : undefined,
          };
        } catch (e) {
          console.warn("Failed to parse FakeCatcher image result:", e);
        }
      }

      const scanId = `fc-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setJobMeta(scanId, {
        userId,
        fileName,
        fileType,
        source: "fakecatcher",
        createdAt: new Date().toISOString(),
        imageData,
      });

      if (fcOutcome) {
        setJobFakeCatcherAnalysis(scanId, {
          label: fcOutcome.label,
          confidence: fcOutcome.confidence,
          fake_prob: fcOutcome.fake_prob,
          analyzedAt: new Date().toISOString(),
        });
      }

      // Determine final status for MongoDB
      const finalStatus = fcOutcome ? (fcOutcome.label === "FAKE" ? "DEEPFAKE" : fcOutcome.label === "REAL" ? "AUTHENTIC" : "SUSPICIOUS") : "UNCERTAIN";
      const finalConfidence = fcOutcome?.confidence ? Math.round(fcOutcome.confidence * 10) / 10 : 50;
      
      // Save to MongoDB for dashboard
      try {
        await connectToDatabase();
        await VerificationResult.create({
          userId,
          scanId,
          fileName,
          fileType,
          status: (finalStatus === "UNCERTAIN" ? "SUSPICIOUS" : finalStatus) as "AUTHENTIC" | "SUSPICIOUS" | "DEEPFAKE",
          confidenceScore: finalConfidence,
          modelsUsed: ["FakeCatcher"],
          imageUrl: imageData || "",
          fcAnalysis: fcOutcome ? {
            label: fcOutcome.label,
            confidence: fcOutcome.confidence,
            fake_prob: fcOutcome.fake_prob,
            analyzedAt: new Date().toISOString(),
          } : undefined,
          createdAt: new Date(),
        });
      } catch (dbError) {
        console.warn("Failed to save image scan to MongoDB:", dbError);
      }

      return NextResponse.json(
        {
          scanId,
          status: finalStatus,
          fileName,
          fileType,
          dualModel: {
            fakecatcher: Boolean(fcOutcome),
            realityDefender: false,
          },
          fc: fcOutcome ? {
            label: fcOutcome.label,
            confidence: fcOutcome.confidence,
            fake_prob: fcOutcome.fake_prob,
          } : null,
        },
        { status: 200 }
      );
    }

    if (fileType === "video" && uploadedFile) {
      const payload = new FormData();
      payload.append("file", uploadedFile);

      const submit = await postVideoWithRetry(payload, 2);
      if (!submit.ok) {
        if (chargedUserId) {
          await refundUserCredit(userId);
          chargedUserId = null;
        }

        return NextResponse.json(
          { error: parseBackendError(submit.body) },
          { status: submit.status }
        );
      }

      const parsed = JSON.parse(submit.body) as { job_id: string; status?: string; filename?: string };
      setJobMeta(parsed.job_id, {
        userId,
        fileName: parsed.filename || fileName,
        fileType,
        source: "fakecatcher",
        createdAt: new Date().toISOString(),
        imageData: imageData,
      });

      return NextResponse.json(
        {
          scanId: parsed.job_id,
          status: parsed.status || "queued",
          fileName: parsed.filename || fileName,
          fileType,
          dualModel: {
            fakecatcher: true,
            realityDefender: false,
          },
        },
        { status: 202 }
      );
    }

    return NextResponse.json(
      { error: "Unsupported file type for direct scan. Please upload image or video." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error proxying scans POST request:", error);
    if (chargedUserId) {
      try {
        await refundUserCredit(chargedUserId);
      } catch (refundError) {
        console.error("Failed to refund user credit after scan error:", refundError);
      }
    }
    const err = error as { message?: string; cause?: { code?: string } };
    const timeoutLike =
      err.cause?.code === "UND_ERR_HEADERS_TIMEOUT" ||
      err.cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
      err.cause?.code === "ABORT_ERR";
    return NextResponse.json(
      {
        error: timeoutLike
          ? `Backend request timed out after ${Math.round(BACKEND_REQUEST_TIMEOUT_MS / 1000)}s`
          : `Failed to reach backend: ${err.message || "network error"}`,
      },
      { status: timeoutLike ? 504 : 502 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getJobMeta, getJobFakeCatcherAnalysis, listUserJobMeta, setJobMeta, setJobRdAnalysis } from "@/lib/fakecatcherStore";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { VerificationResult } from "@/lib/models/VerificationResult";
import verifyMedia from "@/lib/realityDefender";
import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegStatic from 'ffmpeg-static';

const execFileAsync = promisify(execFile);
import { writeFile, mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";


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
const SAGEMAKER_ENDPOINT_NAME = process.env.SAGEMAKER_ENDPOINT_NAME || "";
const SAGEMAKER_REGION = process.env.SAGEMAKER_REGION || "us-east-1";
const VIDEO_FRAME_SAMPLE_COUNT = 3;

const sagemakerClient = new SageMakerRuntimeClient({ region: SAGEMAKER_REGION });


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

async function extractVideoFrames(videoBuffer: Buffer, count: number): Promise<Buffer[]> {
  const workDir = await mkdtemp(path.join(tmpdir(), "gotham-video-"));
  const inputPath = path.join(workDir, "input.mp4");
  await writeFile(inputPath, videoBuffer);
  try {
    const probeResult = await execFileAsync(ffmpegStatic as string, ["-i", inputPath, "-hide_banner"], { encoding: "utf8" }).catch(e => e);
    const durationMatch = (probeResult.stderr || "").match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    const duration = durationMatch ? parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseFloat(durationMatch[3]) : 10;
    const framePaths: string[] = [];
    for (let i = 0; i < count; i++) {
      const ts = Math.max(0, duration * (i + 1) / (count + 1));
      const outPath = path.join(workDir, "frame_" + i + ".jpg");
      framePaths.push(outPath);
      await execFileAsync(ffmpegStatic as string, ["-ss", String(ts), "-i", inputPath, "-vframes", "1", "-vf", "scale=224:224", "-y", outPath]);
    }
    return await Promise.all(framePaths.map((p) => readFile(p)));
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function invokeGothamEndpoint(frameBuffer: Buffer): Promise<{ label: string; score: number; confidence: number } | null> {
  if (!SAGEMAKER_ENDPOINT_NAME) return null;
  try {
    const command = new InvokeEndpointCommand({ EndpointName: SAGEMAKER_ENDPOINT_NAME, ContentType: "application/x-image", Accept: "application/json", Body: frameBuffer });
    const response = await sagemakerClient.send(command);
    const bodyText = Buffer.from(response.Body as Uint8Array).toString("utf-8");
    return JSON.parse(bodyText) as { label: string; score: number; confidence: number };
  } catch (error) {
    console.error("SageMaker invocation failed:", error);
    return null;
  }
}

async function analyzeVideoWithGotham(videoBuffer: Buffer): Promise<{ status: string; confidenceScore: number; frameResults: Array<{ label: string; score: number; confidence: number }>; error?: string }> {
  let frames: Buffer[];
  try {
    frames = await extractVideoFrames(videoBuffer, VIDEO_FRAME_SAMPLE_COUNT);
  } catch (error) {
    console.error("Frame extraction failed:", error);
    return { status: "ERROR", confidenceScore: 0, frameResults: [], error: "Failed to extract frames from video" };
  }
  const results = await Promise.all(frames.map((f) => invokeGothamEndpoint(f)));
  const validResults = results.filter((r): r is { label: string; score: number; confidence: number } => r !== null);
  if (validResults.length === 0) return { status: "ERROR", confidenceScore: 0, frameResults: [], error: "Model endpoint unavailable" };
  const avgScore = validResults.reduce((sum, r) => sum + r.score, 0) / validResults.length;
  const status = mapCombinedStatus(avgScore);
  const confidenceScore = Math.round((status === "AUTHENTIC" ? 1 - avgScore : avgScore) * 100);
  return { status, confidenceScore, frameResults: validResults };
}

async function consumeUserCredit(userId: string) {
  await connectToDatabase();

  const updatedUser = await User.findOneAndUpdate(
    { clerkId: userId, credits: { $gte: CREDIT_COST_PER_SCAN } },
    { $inc: { credits: -CREDIT_COST_PER_SCAN, creditsUsed: CREDIT_COST_PER_SCAN, scanCount: 1 } },
    { new: true }
  ).select("credits creditsUsed scanCount");

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
    { $inc: { credits: CREDIT_COST_PER_SCAN, creditsUsed: -CREDIT_COST_PER_SCAN, scanCount: -1 } }
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
    const maxScanEntries = 200;

    const backendScans = Object.entries(jobs)
      .sort(([, a], [, b]) => (a.age_sec ?? Number.MAX_SAFE_INTEGER) - (b.age_sec ?? Number.MAX_SAFE_INTEGER))
      .slice(0, maxScanEntries)
      .map(([jobId, job]) => {
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
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, maxScanEntries)
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

    // Also include persisted verification results from DB so history survives server restarts.
    // Limit DB fetch to latest N entries to avoid long queries.
    let scans = [];
    try {
      await connectToDatabase();
      const fetchLimit = 200;
      const dbTop = await VerificationResult.find({ userId })
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .hint({ userId: 1, createdAt: -1 })
        .maxTimeMS(3000)
        .lean();

      const dbScans = (dbTop || []).map((d: any) => ({
        _id: d._id,
        scanId: d.scanId || d._id,
        fileName: d.fileName,
        fileType: d.fileType,
        status: d.status,
        confidenceScore: d.confidenceScore,
        createdAt: d.createdAt || d.createdAt,
        imageUrl: d.imageUrl || "",
      }));

      // Merge backendScans, rdOnlyScans and dbScans, dedupe by scanId (prefer DB entries)
      const byScan = new Map<string, any>();
      for (const s of dbScans) byScan.set(String(s.scanId), s);
      for (const s of backendScans) if (!byScan.has(String(s.scanId))) byScan.set(String(s.scanId), s);
      for (const s of rdOnlyScans) if (!byScan.has(String(s.scanId))) byScan.set(String(s.scanId), s);

      scans = Array.from(byScan.values())
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, maxScanEntries);
    } catch (dbErr) {
      // If DB is unavailable, fall back to in-memory cached entries (fast path)
      scans = [...backendScans, ...rdOnlyScans].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }

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

    let rdOutcome: {
      requestId?: string;
      status: string;
      score: number;
      models: Array<{ name: string; status: string; score: number }>;
      error?: string;
    } = {
      status: "DISABLED",
      score: 0,
      models: [],
    };

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

      try {
        const rdBuffer = Buffer.from(await uploadedFile.arrayBuffer());
        const rdResponse = await verifyMedia({ fileBuffer: rdBuffer, fileType: "image" });

        rdOutcome = {
          requestId: rdResponse.requestId,
          status: rdResponse.status,
          score: rdResponse.score,
          models: rdResponse.models.map((m) => ({
            name: m.name,
            status: m.status,
            score: m.score,
          })),
        };
      } catch (rdError) {
        console.error("Reality Defender scan failed:", rdError);
        rdOutcome = {
          status: "ERROR",
          score: 0,
          models: [],
          error: rdError instanceof Error ? rdError.message : String(rdError),
        };
      }

      const scanId = `rd-img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setJobMeta(scanId, {
        userId,
        fileName,
        fileType,
        source: "rd-only",
        createdAt: new Date().toISOString(),
        imageData,
      });

      setJobRdAnalysis(scanId, {
        requestId: rdOutcome.requestId,
        status: rdOutcome.status,
        score: rdOutcome.score,
        models: rdOutcome.models,
        analyzedAt: new Date().toISOString(),
        error: rdOutcome.error,
      });

      let finalStatus = "SUSPICIOUS";
      let finalConfidence = 50;

      if (rdOutcome.status === "AUTHENTIC") {
        finalStatus = "AUTHENTIC";
        finalConfidence = Math.round((1 - rdOutcome.score) * 100);
      } else if (rdOutcome.status === "MANIPULATED") {
        finalStatus = "DEEPFAKE";
        finalConfidence = Math.round(rdOutcome.score * 100);
      } else if (rdOutcome.status === "ERROR") {
        finalStatus = "ERROR";
        finalConfidence = 0;
      }

      const modelsUsed = ["RealityDefender"];
      const rdUsed = rdOutcome.status !== "DISABLED" && rdOutcome.status !== "ERROR";
      
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
          modelsUsed,
          requestPath: req.nextUrl.pathname,
          method: "POST",
          rdAnalysis: {
            requestId: rdOutcome.requestId,
            status: rdOutcome.status,
            score: rdOutcome.score,
            models: rdOutcome.models,
            analyzedAt: new Date().toISOString(),
            error: rdOutcome.error,
          },
          imageUrl: imageData || "",
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
          confidenceScore: finalConfidence,
          dualModel: {
            fakecatcher: false,
            realityDefender: rdUsed,
          },
          rd: rdOutcome.status !== "ERROR" ? {
            requestId: rdOutcome.requestId,
            status: rdOutcome.status,
            score: rdOutcome.score,
            models: rdOutcome.models,
          } : null,
        },
        { status: rdOutcome.status === "ERROR" ? 500 : 200 }
      );
    }
    if (fileType === "video" && uploadedFile) {
      const videoBuffer = Buffer.from(await uploadedFile.arrayBuffer());
      const analysis = await analyzeVideoWithGotham(videoBuffer);

      if (analysis.status === "ERROR") {
        if (chargedUserId) {
          await refundUserCredit(userId);
          chargedUserId = null;
        }
        return NextResponse.json({ error: analysis.error || "Video analysis failed" }, { status: 502 });
      }

      const scanId = `gotham-vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      try {
        await connectToDatabase();
        await VerificationResult.create({
          userId,
          scanId,
          fileName,
          fileType,
          status: analysis.status as "AUTHENTIC" | "SUSPICIOUS" | "DEEPFAKE",
          confidenceScore: analysis.confidenceScore,
          modelsUsed: ["GothamSwinV3"],
          requestPath: req.nextUrl.pathname,
          method: "POST",
          imageUrl: "",
          createdAt: new Date(),
        });
      } catch (dbError) {
        console.warn("Failed to save video scan to MongoDB:", dbError);
      }

      setJobMeta(scanId, {
        userId,
        fileName,
        fileType,
        source: "fakecatcher",
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          scanId,
          status: analysis.status,
          fileName,
          fileType,
          confidenceScore: analysis.confidenceScore,
          dualModel: {
            fakecatcher: true,
            realityDefender: false,
          },
        },
        { status: 200 }
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



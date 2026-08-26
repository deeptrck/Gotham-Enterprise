import { NextRequest, NextResponse } from "next/server";
import { auth, getOrganizationId } from "@/lib/auth";
import { createHash } from "crypto";
import { beginModelInvocation, completeModelInvocation } from "@/lib/repositories/operationalRepositories";
import { consumeCreditForScan, refundCreditForScan } from "@/lib/repositories/users";
import { listVerificationResults, insertVerificationResult } from "@/lib/repositories/verificationResults";
import { analyzeWithGothamModel, isGothamModelConfigured } from "@/lib/gothamModel";
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffmpegStatic from 'ffmpeg-static';

const execFileAsync = promisify(execFile);
import { writeFile, mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";



const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ACCEPTED_VIDEO_EXT = [".mp4", ".avi", ".mov", ".mkv"];
const ACCEPTED_IMAGE_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
const ACCEPTED_AUDIO_EXT = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"];

const CREDIT_COST_PER_SCAN = 1;
const VIDEO_FRAME_SAMPLE_COUNT = 3;

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

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mapCombinedStatus(score: number) {
  if (score >= 0.65) return "DEEPFAKE";
  if (score <= 0.35) return "AUTHENTIC";
  return "SUSPICIOUS";
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

async function invokeGothamEndpoint(frameBuffer: Buffer, scope: { organizationId: string; actorUserId?: string }, userId: string, idempotencyKey: string, frameIndex: number): Promise<{ label: string; score: number; confidence: number } | null> {
  if (!isGothamModelConfigured()) return null;
  const started = await beginModelInvocation({
    scope,
    idempotencyKey: `${idempotencyKey}:frame:${frameIndex}`,
    endpointName: process.env.SAGEMAKER_ENDPOINT_NAME!,
    userId,
    requestContentType: "application/x-image",
    requestMetadata: { frameIndex },
  });
  if (started.reused && started.invocation.status === "succeeded" && started.invocation.response_metadata?.result) return started.invocation.response_metadata.result as { label: string; score: number; confidence: number };
  if (started.reused) throw new Error("A video frame invocation with this idempotency key is already processing");
  const startedAt = Date.now();
  try {
    const result = await analyzeWithGothamModel(frameBuffer, "application/x-image");
    const normalized = { label: result.label, score: result.score, confidence: result.confidence };
    await completeModelInvocation({ scope, id: started.invocation.id, status: "succeeded", latencyMs: Date.now() - startedAt, responseMetadata: { result: normalized } });
    return normalized;
  } catch (error) {
    await completeModelInvocation({ scope, id: started.invocation.id, status: "failed", latencyMs: Date.now() - startedAt, errorCode: "SAGEMAKER_INVOCATION_FAILED" });
    throw error;
  }
}

async function analyzeVideoWithGotham(videoBuffer: Buffer, scope: { organizationId: string; actorUserId?: string }, userId: string, idempotencyKey: string): Promise<{ status: string; confidenceScore: number; frameResults: Array<{ label: string; score: number; confidence: number }>; error?: string }> {
  let frames: Buffer[];
  try {
    frames = await extractVideoFrames(videoBuffer, VIDEO_FRAME_SAMPLE_COUNT);
  } catch (error) {
    console.error("Frame extraction failed:", error);
    return { status: "ERROR", confidenceScore: 0, frameResults: [], error: "Failed to extract frames from video" };
  }
  const results = await Promise.all(frames.map((f, index) => invokeGothamEndpoint(f, scope, userId, idempotencyKey, index)));
  const validResults = results.filter((r): r is { label: string; score: number; confidence: number } => r !== null);
  if (validResults.length === 0) return { status: "ERROR", confidenceScore: 0, frameResults: [], error: "Model endpoint unavailable" };
  const avgScore = validResults.reduce((sum, r) => sum + r.score, 0) / validResults.length;
  const status = mapCombinedStatus(avgScore);
  const confidenceScore = Math.round((status === "AUTHENTIC" ? 1 - avgScore : avgScore) * 100);
  return { status, confidenceScore, frameResults: validResults };
}

async function consumeUserCredit(scope: { organizationId: string; actorUserId?: string }, userId: string, idempotencyKey?: string) {
  const user = await consumeCreditForScan(scope, userId, CREDIT_COST_PER_SCAN, idempotencyKey);
  if (user) return { ok: true as const, user };
  return { ok: false as const, reason: "INSUFFICIENT_CREDITS" as const };
}

async function refundUserCredit(scope: { organizationId: string; actorUserId?: string }, userId: string, idempotencyKey?: string) {
  await refundCreditForScan(scope, userId, CREDIT_COST_PER_SCAN, idempotencyKey);
}


export async function GET() {
  try {
    const { userId, user } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = getOrganizationId(user);
    if (!organizationId) return NextResponse.json({ error: "Organization context required" }, { status: 403 });
    const results = await listVerificationResults({ scope: { organizationId, actorUserId: userId }, userId, limit: 100, offset: 0 });
    return NextResponse.json(results.rows.map((result) => ({ _id: result.id, scanId: result.scan_id, fileName: result.file_name, fileType: result.file_type, status: result.status, confidenceScore: result.confidence_score, createdAt: result.created_at, imageUrl: result.image_url || "" })), { status: 200 });
  } catch (error) {
    console.error("Error listing PostgreSQL scans:", error);
    return NextResponse.json({ error: "Scan history unavailable" }, { status: 503 });
  }
}
export async function POST(req: NextRequest) {
  let chargedUserId: string | null = null;
  let requestScope: { organizationId: string; actorUserId?: string } | null = null;
  let imageData: string | undefined;
  try {
    const { userId, user } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = getOrganizationId(user);
    if (!organizationId) return NextResponse.json({ error: "Organization context required" }, { status: 403 });
    requestScope = { organizationId, actorUserId: userId };

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

    // Fail closed until the proprietary AWS model endpoint is configured. Do not
    // silently route customer media to a temporary third-party detector.
    if (!isGothamModelConfigured()) {
      return NextResponse.json(
        { error: "Gotham verification is temporarily unavailable while the AWS model endpoint is being configured." },
        { status: 503 }
      );
    }

    const chargeResult = await consumeUserCredit({ organizationId, actorUserId: userId }, userId);
    if (!chargeResult.ok) {

      return NextResponse.json(
        { error: "Insufficient credits. Please top up to continue scanning." },
        { status: 402 }
      );
    }
    chargedUserId = userId;

    if (fileType === "image" && uploadedFile) {
      const mediaBuffer = Buffer.from(await uploadedFile.arrayBuffer());
      const key = req.headers.get("idempotency-key")?.trim() || "scan:image:" + createHash("sha256").update(mediaBuffer).digest("hex");
      const started = await beginModelInvocation({
        scope: requestScope!, idempotencyKey: key, endpointName: process.env.SAGEMAKER_ENDPOINT_NAME!,
        userId, requestContentType: uploadedFile.type || "application/octet-stream",
        requestMetadata: { fileName, fileType },
      });
      let modelResult: Awaited<ReturnType<typeof analyzeWithGothamModel>>;
      const scanId = (started.invocation.response_metadata?.scanId as string | undefined) || crypto.randomUUID();
      if (started.reused && started.invocation.status === "succeeded" && started.invocation.response_metadata?.result) {
        modelResult = started.invocation.response_metadata.result as Awaited<ReturnType<typeof analyzeWithGothamModel>>;
      } else if (started.reused) {
        return NextResponse.json({ error: "A scan with this idempotency key is already processing" }, { status: 409 });
      } else {
        const startedAt = Date.now();
        try {
          modelResult = await analyzeWithGothamModel(mediaBuffer, uploadedFile.type || "application/octet-stream");
          await completeModelInvocation({ scope: requestScope!, id: started.invocation.id, status: "succeeded", latencyMs: Date.now() - startedAt, responseMetadata: { scanId, result: modelResult } });
        } catch (error) {
          await completeModelInvocation({ scope: requestScope!, id: started.invocation.id, status: "failed", latencyMs: Date.now() - startedAt, errorCode: "SAGEMAKER_INVOCATION_FAILED", responseMetadata: { scanId } });
          throw error;
        }
      }
      const status = modelResult.label === "FAKE" ? "DEEPFAKE" : modelResult.label === "REAL" ? "AUTHENTIC" : "SUSPICIOUS";
      const confidenceScore = Math.round(modelResult.confidence * 100);
      await insertVerificationResult({ scope: requestScope!, userId, scanId, fileName, fileType, status, confidenceScore, modelsUsed: [modelResult.model], imageUrl: imageData || null, proprietaryAnalysis: { model: modelResult.model, version: modelResult.version, score: modelResult.score, confidence: modelResult.confidence, raw: modelResult.raw } });
      return NextResponse.json({ scanId, status, fileName, fileType, confidenceScore, model: modelResult.model, version: modelResult.version }, { status: 200 });
    }
    if (fileType === "video" && uploadedFile) {
      const videoBuffer = Buffer.from(await uploadedFile.arrayBuffer());
      const videoKey = req.headers.get("idempotency-key")?.trim() || "scan:video:" + createHash("sha256").update(videoBuffer).digest("hex");
      const analysis = await analyzeVideoWithGotham(videoBuffer, requestScope!, userId, videoKey);

      if (analysis.status === "ERROR") {
        if (chargedUserId) {
          await refundUserCredit(requestScope!, userId);
          chargedUserId = null;
        }
        return NextResponse.json({ error: analysis.error || "Video analysis failed" }, { status: 502 });
      }

      const scanId = `gotham-vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      try {
        await insertVerificationResult({
          scope: { organizationId, actorUserId: userId },
          userId,
          scanId,
          fileName,
          fileType,
          status: analysis.status as "AUTHENTIC" | "SUSPICIOUS" | "DEEPFAKE",
          confidenceScore: analysis.confidenceScore,
          modelsUsed: ["GothamSwinV3"],
          imageUrl: null,
        });
      } catch (dbError) {
        console.warn("Failed to save video scan to PostgreSQL:", dbError);
      }


      return NextResponse.json({ scanId, status: analysis.status, fileName, fileType, confidenceScore: analysis.confidenceScore, model: "gotham-core" }, { status: 200 });
    }

    return NextResponse.json(
      { error: "Unsupported file type for direct scan. Please upload image or video." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error proxying scans POST request:", error);
    if (chargedUserId) {
      try {
        await refundUserCredit(requestScope!, chargedUserId);
      } catch (refundError) {
        console.error("Failed to refund user credit after scan error:", refundError);
      }
    }
    const message = error instanceof Error ? error.message : "SageMaker verification failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}



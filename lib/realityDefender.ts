import type { IncomingHttpHeaders } from "http";
import fs from "fs";
import os from "os";
import path from "path";
import fetch from "node-fetch";

const RD_MOCK = (process.env.RD_MOCK || "false").toLowerCase() === "true";
const REALITY_DEFENDER_ENABLED = (process.env.REALITY_DEFENDER_ENABLED ?? "true").toLowerCase() === "true";

export interface RDModelResult {
  name: string;
  status: string;
  score: number;
}

export interface RDResult {
  requestId: string;
  status: string;
  score: number;
  models: RDModelResult[];
}

export async function verifyMedia(options: {
  url?: string;
  fileBuffer?: Buffer;
  headers?: IncomingHttpHeaders;
  fileType?: "image" | "video" | "audio";
}): Promise<RDResult> {
  if (!REALITY_DEFENDER_ENABLED) {
    throw new Error("Reality Defender provider is disabled; use the proprietary Gotham model provider");
  }

  if (RD_MOCK) {
    return {
      requestId: "mock-job",
      status: "AUTHENTIC",
      score: 0.42,
      models: [
        { name: "rd-context-img", status: "AUTHENTIC", score: 0.07 },
        { name: "rd-img-ensemble", status: "AUTHENTIC", score: 0.364 },
      ],
    };
  }

  let tmpPath: string | null = null;

  try {
    console.log("RD import attempt...");
    type RDModuleShape = { RealityDefender?: unknown; default?: unknown } & Record<string, unknown>;
    const RDmod = (await import("@realitydefender/realitydefender")) as RDModuleShape;
    const RDModule = (RDmod.default ?? RDmod) as RDModuleShape;
    console.log("RD loaded:", Object.keys(RDModule || {}));

    const apiKey = process.env.REALITY_DEFENDER_API_KEY;
    if (!apiKey) throw new Error("REALITY_DEFENDER_API_KEY not set");

    // Instantiate client will be resolved below based on module shape

    // Prepare local file
    let filePath: string;
    if (options.fileBuffer) {
      const ext = options.fileType === "video" ? ".mp4" : ".png";
      tmpPath = path.join(os.tmpdir(), `rd-upload-${Date.now()}${ext}`);
      fs.writeFileSync(tmpPath, options.fileBuffer);
      filePath = tmpPath;
    } else if (options.url) {
      // Normalize IncomingHttpHeaders -> HeadersInit
      const headersObj: Record<string, string> | undefined = options.headers
        ? Object.fromEntries(
            Object.entries(options.headers as Record<string, unknown>).map(([k, v]) => [k, String(v)])
          )
        : undefined;
      const response = await fetch(options.url, { headers: headersObj });
      if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const ext = path.extname(options.url) || ".png";
      tmpPath = path.join(os.tmpdir(), `rd-upload-${Date.now()}${ext}`);
      fs.writeFileSync(tmpPath, Buffer.from(arrayBuffer));
      filePath = tmpPath;
    } else {
      throw new Error("No media provided");
    }

    console.log("Calling RD.detect with:", { filePath, type: options.fileType || "image" });

    // Upload + analyze — prefer `detect` or `scan.create` depending on SDK
    // Resolve a possible constructor from module
    type RDClientType = {
      detect?: (opts: { filePath: string; type: string }) => Promise<unknown>;
      scan?: { create?: (opts: { filePath: string; type: string }) => Promise<unknown>; result?: (id: string) => Promise<unknown> };
      create?: (opts: { filePath: string; type: string }) => Promise<unknown>;
      [key: string]: unknown;
    };

    type RDConstructorType = new (opts: { apiKey: string }) => RDClientType;

    const RDConstructor = (RDModule.RealityDefender ?? (RDModule as unknown)) as unknown as RDConstructorType;
    const client = new RDConstructor({ apiKey }) as RDClientType;

    const detectFunc = typeof client.detect === "function" ? client.detect.bind(client) : undefined;
    const scanCreateFunc = client.scan?.create ? client.scan.create.bind(client.scan) : undefined;

    type DetectResp = {
      id?: string;
      requestId?: string;
      status?: string;
      score?: number;
      models?: Partial<RDModelResult>[];
      [key: string]: unknown;
    };

    const rawResp = scanCreateFunc
      ? await scanCreateFunc({ filePath, type: options.fileType || "image" })
      : detectFunc
      ? await detectFunc({ filePath, type: options.fileType || "image" })
      : await client.create?.({ filePath, type: options.fileType || "image" });

    const detectResp = (rawResp ?? {}) as DetectResp;

    const jobId = detectResp?.id || detectResp?.requestId;
    if (!jobId) throw new Error("Reality Defender did not return a job ID");

    console.log("RD job completed:", jobId);

    // Map and return result
    return {
      requestId: jobId,
      status: detectResp.status ?? "UNKNOWN",
      score: typeof detectResp.score === "number" ? detectResp.score : Number(String(detectResp.score ?? "0")) || 0,
      models:
          detectResp.models?.map((m: Partial<RDModelResult>) => ({
            name: m.name || "unknown",
            status: m.status || "UNKNOWN",
            score: typeof m.score === "number" ? m.score : Number(m.score) || 0,
          })) ?? [],
    };
  } catch (err) {
    console.error("Reality Defender verification failed:", err);
    throw new Error(`Reality Defender verification failed: ${(err as Error).message}`);
  } finally {
    // Cleanup temp file
    try {
      if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (cleanupErr) {
      console.warn("Failed to clean up RD temp file:", cleanupErr);
    }
  }
}

export default verifyMedia;

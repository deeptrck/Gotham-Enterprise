import { InvokeEndpointCommand, SageMakerRuntimeClient } from "@aws-sdk/client-sagemaker-runtime";

export type GothamModelLabel = "REAL" | "FAKE" | "UNCERTAIN";

export interface GothamModelResult {
  label: GothamModelLabel;
  score: number;
  confidence: number;
  model: string;
  version?: string;
  raw?: Record<string, unknown>;
}

const endpointName = process.env.SAGEMAKER_ENDPOINT_NAME?.trim() || "";
const region = process.env.SAGEMAKER_REGION || process.env.AWS_REGION || "us-east-1";
const modelName = process.env.GOTHAM_MODEL_NAME || "gotham-core";
const modelVersion = process.env.GOTHAM_MODEL_VERSION;
const client = new SageMakerRuntimeClient({ region });

function normalizeNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return number > 1 ? number / 100 : number;
}

function normalizeLabel(raw: Record<string, unknown>, score: number): GothamModelLabel {
  const label = String(raw.label ?? raw.verdict ?? raw.status ?? "").toUpperCase();
  if (["FAKE", "DEEPFAKE", "MANIPULATED"].includes(label)) return "FAKE";
  if (["REAL", "AUTHENTIC", "GENUINE"].includes(label)) return "REAL";
  if (typeof raw.is_deepfake === "boolean") return raw.is_deepfake ? "FAKE" : "REAL";
  if (score >= 0.65) return "FAKE";
  if (score <= 0.35) return "REAL";
  return "UNCERTAIN";
}

export function isGothamModelConfigured(): boolean {
  return Boolean(endpointName);
}

export async function analyzeWithGothamModel(
  mediaBuffer: Buffer,
  contentType = "application/octet-stream"
): Promise<GothamModelResult> {
  if (!endpointName) {
    throw new Error("SAGEMAKER_ENDPOINT_NAME is not configured for the proprietary Gotham model");
  }

  const response = await client.send(new InvokeEndpointCommand({
    EndpointName: endpointName,
    ContentType: contentType,
    Accept: "application/json",
    Body: mediaBuffer,
  }));

  const body = Buffer.from(response.Body as Uint8Array).toString("utf8");
  const raw = JSON.parse(body) as Record<string, unknown>;
  const explicitDeepfake = typeof raw.is_deepfake === "boolean" ? raw.is_deepfake : undefined;
  const score = normalizeNumber(raw.manipulation_score ?? raw.fake_probability ?? raw.score ?? raw.confidence_score);
  const label = normalizeLabel(raw, score);
  const confidence = normalizeNumber(raw.confidence ?? raw.confidence_score ?? (label === "UNCERTAIN" ? 0.5 : Math.abs(score - 0.5) * 2));

  return {
    label: explicitDeepfake === undefined ? label : explicitDeepfake ? "FAKE" : "REAL",
    score: Math.max(0, Math.min(1, score)),
    confidence: Math.max(0, Math.min(1, confidence)),
    model: String(raw.model ?? modelName),
    version: String(raw.version ?? modelVersion ?? "unknown"),
    raw,
  };
}

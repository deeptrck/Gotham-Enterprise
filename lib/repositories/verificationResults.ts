import { query } from "@/lib/postgres";
import { TenantScope, requireTenantScope } from "./common";

export type VerificationStatus = "AUTHENTIC" | "SUSPICIOUS" | "DEEPFAKE";
export type FileType = "image" | "video" | "audio";

export interface VerificationResultRecord {
  id: string;
  scan_id: string;
  organization_id: string | null;
  user_id: string;
  file_name: string;
  file_type: FileType;
  status: VerificationStatus;
  confidence_score: number;
  models_used: string[];
  image_url: string | null;
  source_url: string | null;
  description: string | null;
  features: string[];
  review_status: "pending" | "confirmed" | "dismissed" | null;
  feedback_type: "fp" | "fn" | null;
  fc_analysis: Record<string, unknown> | null;
  proprietary_analysis: Record<string, unknown> | null;
  raw_model_payload: Record<string, unknown> | null;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export async function listVerificationResults(input: { scope: TenantScope; userId: string; limit: number; offset: number }): Promise<{ rows: VerificationResultRecord[]; total: number }> {
  requireTenantScope(input.scope);
  const rows = await query<VerificationResultRecord>(
    `SELECT r.id, r.scan_id, r.organization_id, r.user_id, r.file_name, r.file_type, r.status, r.confidence_score,
            r.models_used, r.image_url, r.source_url, r.description, r.features, r.review_status, r.feedback_type,
            r.fc_analysis, r.proprietary_analysis, r.raw_model_payload, r.uploaded_at, r.created_at, r.updated_at,
            COUNT(*) OVER()::integer AS total_count
       FROM verification_results r
      WHERE r.user_id = $1 AND r.organization_id = $4
      ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
    [input.userId, input.limit, input.offset, input.scope.organizationId],
  );
  const total = rows.length ? Number((rows[0] as VerificationResultRecord & { total_count?: number }).total_count ?? rows.length) : 0;
  return { rows, total };
}

export async function findVerificationResult(input: { scope: TenantScope; id: string; userId: string }): Promise<VerificationResultRecord | null> {
  requireTenantScope(input.scope);
  const rows = await query<VerificationResultRecord>(
    `SELECT id, scan_id, organization_id, user_id, file_name, file_type, status, confidence_score,
            models_used, image_url, source_url, description, features, review_status, feedback_type,
            fc_analysis, proprietary_analysis, raw_model_payload, uploaded_at, created_at, updated_at
       FROM verification_results
      WHERE (id::text = $1 OR scan_id::text = $1) AND user_id = $2 AND organization_id = $3 LIMIT 1`,
    [input.id, input.userId, input.scope.organizationId],
  );
  return rows[0] ?? null;
}

export async function insertVerificationResult(input: { scope: TenantScope; scanId: string; userId: string; fileName: string; fileType: FileType; status: VerificationStatus; confidenceScore: number; modelsUsed: string[]; imageUrl?: string | null; sourceUrl?: string | null; description?: string | null; features?: string[]; proprietaryAnalysis?: Record<string, unknown> | null; rawModelPayload?: Record<string, unknown> | null }): Promise<VerificationResultRecord> {
  requireTenantScope(input.scope);
  const rows = await query<VerificationResultRecord>(
    `WITH inserted_scan AS (
       INSERT INTO scans (id, organization_id, user_id, file_name, file_type, status)
       VALUES ($1, $2, $3, $4, $5, 'completed')
       ON CONFLICT (id) DO UPDATE SET updated_at = now()
       WHERE scans.organization_id = EXCLUDED.organization_id AND scans.user_id = EXCLUDED.user_id
       RETURNING id
     )
     INSERT INTO verification_results (scan_id, organization_id, user_id, file_name, file_type, status, confidence_score, models_used, image_url, source_url, description, features, proprietary_analysis, raw_model_payload)
     SELECT id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14 FROM inserted_scan
     ON CONFLICT (scan_id) DO UPDATE SET status = EXCLUDED.status, confidence_score = EXCLUDED.confidence_score, models_used = EXCLUDED.models_used, image_url = EXCLUDED.image_url, proprietary_analysis = EXCLUDED.proprietary_analysis, raw_model_payload = EXCLUDED.raw_model_payload, updated_at = now()
       WHERE verification_results.organization_id = EXCLUDED.organization_id AND verification_results.user_id = EXCLUDED.user_id
     RETURNING *`,
    [input.scanId, input.scope.organizationId, input.userId, input.fileName, input.fileType, input.status, input.confidenceScore, input.modelsUsed, input.imageUrl ?? null, input.sourceUrl ?? null, input.description ?? null, input.features ?? [], input.proprietaryAnalysis ?? null, input.rawModelPayload ?? null],
  );
  if (!rows[0]) throw new Error("Verification result insert returned no row");
  return rows[0];
}

import { query } from "@/lib/postgres";
import { PageResult, TenantScope, boundedPage, requireTenantScope } from "./common";

export type BugReport = { id: string; user_id: string | null; organization_id: string | null; title: string; description: string; status: "open" | "in_progress" | "resolved" | "closed"; priority: "low" | "normal" | "high" | "critical"; metadata: Record<string, unknown>; created_at: string; updated_at: string };
export async function createBugReport(input: { scope: TenantScope; userId?: string; title: string; description: string; priority?: BugReport["priority"]; metadata?: Record<string, unknown> }): Promise<BugReport> {
  requireTenantScope(input.scope);
  const rows = await query<BugReport>(`INSERT INTO bug_reports (user_id, organization_id, title, description, priority, metadata) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [input.userId ?? null, input.scope.organizationId, input.title, input.description, input.priority ?? "normal", input.metadata ?? {}]);
  if (!rows[0]) throw new Error("Bug report creation failed");
  return rows[0];
}
export async function listBugReports(scope: TenantScope, page: { limit?: number; offset?: number } = {}): Promise<PageResult<BugReport>> {
  requireTenantScope(scope);
  const { limit, offset } = boundedPage(page);
  const rows = await query<BugReport & { total_count: number }>(`SELECT b.*, COUNT(*) OVER()::integer AS total_count FROM bug_reports b WHERE b.organization_id = $1 ORDER BY b.created_at DESC LIMIT $2 OFFSET $3`, [scope.organizationId, limit, offset]);
  return { rows, total: rows[0]?.total_count ?? 0 };
}
export async function updateBugReport(scope: TenantScope, id: string, patch: { status?: BugReport["status"]; priority?: BugReport["priority"] }): Promise<BugReport | null> {
  requireTenantScope(scope);
  const rows = await query<BugReport>(`UPDATE bug_reports SET status = COALESCE($3, status), priority = COALESCE($4, priority), updated_at = now() WHERE id = $1 AND organization_id = $2 RETURNING *`, [id, scope.organizationId, patch.status ?? null, patch.priority ?? null]);
  return rows[0] ?? null;
}

export type Webhook = { id: string; organization_id: string; user_id: string | null; url: string; events: string[]; status: "active" | "paused" | "revoked"; last_delivered_at: string | null; last_status_code: number | null; failure_count: number; created_at: string; updated_at: string };
export type WebhookDelivery = { id: string; webhook_id: string; event_type: string; idempotency_key: string; status: "pending" | "delivered" | "failed"; response_status: number | null; response_body: string | null; attempt_count: number; next_attempt_at: string | null; delivered_at: string | null; created_at: string };
export async function listWebhooks(scope: TenantScope): Promise<Webhook[]> {
  requireTenantScope(scope);
  return query<Webhook>(`SELECT id, organization_id, user_id, url, events, status, last_delivered_at, last_status_code, failure_count, created_at, updated_at FROM webhooks WHERE organization_id = $1 AND status <> 'revoked' ORDER BY created_at DESC`, [scope.organizationId]);
}
export async function createWebhook(input: { scope: TenantScope; userId?: string; url: string; events: string[]; secretHash?: string }): Promise<Webhook> {
  requireTenantScope(input.scope);
  if (!input.url.startsWith("https://")) throw new Error("Webhook URL must use HTTPS");
  const rows = await query<Webhook>(`INSERT INTO webhooks (organization_id, user_id, url, secret_hash, events) VALUES ($1,$2,$3,$4,$5) RETURNING id, organization_id, user_id, url, events, status, last_delivered_at, last_status_code, failure_count, created_at, updated_at`, [input.scope.organizationId, input.userId ?? null, input.url, input.secretHash ?? null, input.events]);
  if (!rows[0]) throw new Error("Webhook creation failed");
  return rows[0];
}
export async function enqueueWebhookDelivery(input: { scope: TenantScope; webhookId: string; eventType: string; idempotencyKey: string }): Promise<WebhookDelivery> {
  requireTenantScope(input.scope);
  const rows = await query<WebhookDelivery>(`INSERT INTO webhook_deliveries (webhook_id, event_type, idempotency_key) SELECT w.id, $3, $4 FROM webhooks w WHERE w.id = $1 AND w.organization_id = $2 AND w.status = 'active' ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`, [input.webhookId, input.scope.organizationId, input.eventType, input.idempotencyKey]);
  if (!rows[0]) {
    const existing = await query<WebhookDelivery>(`SELECT d.* FROM webhook_deliveries d JOIN webhooks w ON w.id = d.webhook_id WHERE d.idempotency_key = $1 AND w.organization_id = $2 LIMIT 1`, [input.idempotencyKey, input.scope.organizationId]);
    if (!existing[0]) throw new Error("Webhook is not active or outside organization scope");
    return existing[0];
  }
  return rows[0];
}
export async function markWebhookDelivery(input: { scope: TenantScope; deliveryId: string; status: WebhookDelivery["status"]; responseStatus?: number; responseBody?: string; nextAttemptAt?: string }): Promise<WebhookDelivery | null> {
  requireTenantScope(input.scope);
  const rows = await query<WebhookDelivery>(`UPDATE webhook_deliveries d SET status = $3, response_status = $4, response_body = LEFT($5, 4000), attempt_count = attempt_count + 1, next_attempt_at = $6, delivered_at = CASE WHEN $3 = 'delivered' THEN now() ELSE delivered_at END FROM webhooks w WHERE d.id = $1 AND w.id = d.webhook_id AND w.organization_id = $2 RETURNING d.*`, [input.deliveryId, input.scope.organizationId, input.status, input.responseStatus ?? null, input.responseBody ?? null, input.nextAttemptAt ?? null]);
  return rows[0] ?? null;
}

export type AuditEvent = { id: string; organization_id: string | null; actor_user_id: string | null; actor_auth0_sub: string | null; event_type: string; entity_type: string | null; entity_id: string | null; detail: Record<string, unknown>; ip: string | null; user_agent: string | null; created_at: string };
export async function appendAuditEvent(input: { scope: TenantScope; actorUserId?: string; actorAuth0Sub?: string; eventType: string; entityType?: string; entityId?: string; detail?: Record<string, unknown>; ip?: string; userAgent?: string }): Promise<AuditEvent> {
  requireTenantScope(input.scope);
  const rows = await query<AuditEvent>(`INSERT INTO audit_events (organization_id, actor_user_id, actor_auth0_sub, event_type, entity_type, entity_id, detail, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [input.scope.organizationId, input.actorUserId ?? null, input.actorAuth0Sub ?? null, input.eventType, input.entityType ?? null, input.entityId ?? null, input.detail ?? {}, input.ip ?? null, input.userAgent ?? null]);
  if (!rows[0]) throw new Error("Audit event creation failed");
  return rows[0];
}

export type ModelInvocation = { id: string; scan_id: string | null; organization_id: string; user_id: string | null; provider: "aws_sagemaker"; endpoint_name: string; model_name: string | null; model_version: string | null; status: "started" | "succeeded" | "failed" | "timed_out"; request_content_type: string | null; latency_ms: number | null; error_code: string | null; request_metadata: Record<string, unknown>; response_metadata: Record<string, unknown>; idempotency_key: string | null; created_at: string; completed_at: string | null };

export async function beginModelInvocation(input: { scope: TenantScope; idempotencyKey: string; scanId?: string; userId?: string; endpointName: string; modelName?: string; modelVersion?: string; requestContentType?: string; requestMetadata?: Record<string, unknown> }): Promise<{ invocation: ModelInvocation; reused: boolean }> {
  requireTenantScope(input.scope);
  if (!input.idempotencyKey.trim()) throw new Error("Model invocation idempotency key is required");
  const rows = await query<ModelInvocation>(`INSERT INTO model_invocations (scan_id, organization_id, user_id, provider, endpoint_name, model_name, model_version, status, request_content_type, request_metadata, idempotency_key) VALUES ($1,$2,$3,'aws_sagemaker',$4,$5,$6,'started',$7,$8,$9) ON CONFLICT (organization_id, idempotency_key) DO NOTHING RETURNING *`, [input.scanId ?? null, input.scope.organizationId, input.userId ?? null, input.endpointName, input.modelName ?? null, input.modelVersion ?? null, input.requestContentType ?? null, input.requestMetadata ?? {}, input.idempotencyKey]);
  if (rows[0]) return { invocation: rows[0], reused: false };
  const existing = await query<ModelInvocation>(`SELECT * FROM model_invocations WHERE organization_id = $1 AND idempotency_key = $2 LIMIT 1`, [input.scope.organizationId, input.idempotencyKey]);
  if (!existing[0]) throw new Error("Model invocation idempotency conflict could not be resolved");
  return { invocation: existing[0], reused: true };
}

export const createModelInvocation = beginModelInvocation;
export async function completeModelInvocation(input: { scope: TenantScope; id: string; status: Exclude<ModelInvocation["status"], "started">; latencyMs?: number; errorCode?: string; responseMetadata?: Record<string, unknown> }): Promise<ModelInvocation | null> {
  requireTenantScope(input.scope);
  const rows = await query<ModelInvocation>(`UPDATE model_invocations SET status = $3, latency_ms = $4, error_code = $5, response_metadata = $6, completed_at = now() WHERE id = $1 AND organization_id = $2 AND provider = 'aws_sagemaker' AND status = 'started' RETURNING *`, [input.id, input.scope.organizationId, input.status, input.latencyMs ?? null, input.errorCode ?? null, input.responseMetadata ?? {}]);
  if (rows[0]) return rows[0];
  const existing = await query<ModelInvocation>(`SELECT * FROM model_invocations WHERE id = $1 AND organization_id = $2 AND provider = 'aws_sagemaker' LIMIT 1`, [input.id, input.scope.organizationId]);
  return existing[0] ?? null;
}

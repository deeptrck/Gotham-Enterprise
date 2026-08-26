import { query } from "@/lib/postgres";
import { PageResult, TenantScope, boundedPage, requireTenantScope } from "./common";

export type Organization = { id: string; name: string; slug: string; status: "active" | "suspended" | "archived"; created_at: string; updated_at: string };
export type Membership = { organization_id: string; user_id: string; role: "owner" | "admin" | "analyst" | "viewer"; status: "active" | "invited" | "suspended" | "revoked"; created_at: string; updated_at: string };

export async function findOrganization(scope: TenantScope, id: string): Promise<Organization | null> {
  requireTenantScope(scope);
  const rows = await query<Organization>(`SELECT id, name, slug, status, created_at, updated_at FROM organizations WHERE id = $1 AND id = $2 LIMIT 1`, [scope.organizationId, id]);
  return rows[0] ?? null;
}

export async function listUserOrganizations(scope: TenantScope, userId: string): Promise<Array<Organization & { role: Membership["role"] }>> {
  requireTenantScope(scope);
  return query<Organization & { role: Membership["role"] }>(
    `SELECT o.id, o.name, o.slug, o.status, o.created_at, o.updated_at, m.role
       FROM organizations o JOIN organization_memberships m ON m.organization_id = o.id
      WHERE m.user_id = $1 AND m.organization_id = $2 AND m.status = 'active' AND o.status = 'active'
      ORDER BY o.name`,
    [userId, scope.organizationId],
  );
}

export async function getMembership(scope: TenantScope): Promise<Membership | null> {
  requireTenantScope(scope);
  if (!scope.actorUserId) return null;
  const rows = await query<Membership>(`SELECT * FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`, [scope.organizationId, scope.actorUserId]);
  return rows[0] ?? null;
}

export async function requireMembership(scope: TenantScope, roles?: Membership["role"][]): Promise<Membership> {
  const membership = await getMembership(scope);
  if (!membership || (roles && !roles.includes(membership.role))) throw new Error("Organization membership is not authorized");
  return membership;
}

export type Scan = { id: string; organization_id: string | null; user_id: string; file_name: string; file_type: "image" | "video" | "audio"; request_path: string | null; request_method: string | null; status: "processing" | "completed" | "failed"; created_at: string; updated_at: string };

export async function listScans(scope: TenantScope, page: { limit?: number; offset?: number } = {}): Promise<PageResult<Scan>> {
  requireTenantScope(scope);
  const { limit, offset } = boundedPage(page);
  const rows = await query<Scan & { total_count: number }>(
    `SELECT s.*, COUNT(*) OVER()::integer AS total_count FROM scans s
      WHERE s.organization_id = $1 ORDER BY s.created_at DESC LIMIT $2 OFFSET $3`, [scope.organizationId, limit, offset]);
  return { rows, total: rows[0]?.total_count ?? 0 };
}

export async function findScan(scope: TenantScope, scanId: string): Promise<Scan | null> {
  requireTenantScope(scope);
  const rows = await query<Scan>(`SELECT * FROM scans WHERE id = $1 AND organization_id = $2 LIMIT 1`, [scanId, scope.organizationId]);
  return rows[0] ?? null;
}

export async function createScan(input: { scope: TenantScope; id?: string; userId: string; fileName: string; fileType: Scan["file_type"]; requestPath?: string; requestMethod?: string }): Promise<Scan> {
  requireTenantScope(input.scope);
  const rows = await query<Scan>(`INSERT INTO scans (id, organization_id, user_id, file_name, file_type, request_path, request_method) VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7) RETURNING *`, [input.id ?? null, input.scope.organizationId, input.userId, input.fileName, input.fileType, input.requestPath ?? null, input.requestMethod ?? null]);
  if (!rows[0]) throw new Error("Scan creation failed");
  return rows[0];
}

export type ApiKey = { id: string; organization_id: string | null; user_id: string; key_prefix: string; name: string; last_used_at: string | null; expires_at: string | null; revoked_at: string | null; created_at: string };
export async function listApiKeys(scope: TenantScope): Promise<ApiKey[]> {
  requireTenantScope(scope);
  return query<ApiKey>(`SELECT id, organization_id, user_id, key_prefix, name, last_used_at, expires_at, revoked_at, created_at FROM api_keys WHERE organization_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC`, [scope.organizationId]);
}
export async function revokeApiKey(scope: TenantScope, keyId: string): Promise<boolean> {
  requireTenantScope(scope);
  const rows = await query<{ id: string }>(`UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL RETURNING id`, [keyId, scope.organizationId]);
  return Boolean(rows[0]);
}

export type Payment = { id: string; user_id: string | null; organization_id: string | null; provider: string; provider_reference: string; amount_minor: number; currency: string; status: "initialized" | "paid" | "failed" | "refunded"; metadata: Record<string, unknown>; created_at: string; updated_at: string };
export async function findPayment(scope: TenantScope, providerReference: string): Promise<Payment | null> {
  requireTenantScope(scope);
  const rows = await query<Payment>(`SELECT * FROM payments WHERE organization_id = $1 AND provider_reference = $2 LIMIT 1`, [scope.organizationId, providerReference]);
  return rows[0] ?? null;
}
export async function upsertPayment(input: { scope: TenantScope; userId?: string; provider: string; providerReference: string; amountMinor: number; currency: string; status: Payment["status"]; metadata?: Record<string, unknown> }): Promise<Payment> {
  requireTenantScope(input.scope);
  const rows = await query<Payment>(`INSERT INTO payments (user_id, organization_id, provider, provider_reference, amount_minor, currency, status, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (provider_reference) DO UPDATE SET status = EXCLUDED.status, metadata = EXCLUDED.metadata, updated_at = now() RETURNING *`, [input.userId ?? null, input.scope.organizationId, input.provider, input.providerReference, input.amountMinor, input.currency, input.status, input.metadata ?? {}]);
  if (!rows[0]) throw new Error("Payment upsert failed");
  return rows[0];
}

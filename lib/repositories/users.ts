import { PoolClient } from "pg";
import { query, withTransaction } from "@/lib/postgres";
import { TenantScope, requireTenantScope } from "./common";

export type UserPlan = "trial" | "starter" | "growth" | "enterprise";
export interface GothamUser {
  id: string;
  auth0_sub: string;
  email: string;
  full_name: string;
  image_url: string | null;
  credits: number;
  credits_used: number;
  scan_count: number;
  plan: UserPlan;
  trial_used: boolean;
  status: "active" | "suspended" | "deleted";
  created_at: string;
  updated_at: string;
}

const USER_COLUMNS = "u.id, u.auth0_sub, u.email, u.full_name, u.image_url, u.credits, u.credits_used, u.scan_count, u.plan, u.trial_used, u.status, u.created_at, u.updated_at";
const USER_COLUMNS_NO_ALIAS = "id, auth0_sub, email, full_name, image_url, credits, credits_used, scan_count, plan, trial_used, status, created_at, updated_at";

export async function findUserByAuth0Sub(scope: TenantScope, auth0Sub: string): Promise<GothamUser | null> {
  requireTenantScope(scope);
  const rows = await query<GothamUser>(
    `SELECT ${USER_COLUMNS} FROM users u JOIN organization_memberships m ON m.user_id = u.id
      WHERE u.auth0_sub = $1 AND m.organization_id = $2 AND m.status = 'active' AND u.status = 'active' LIMIT 1`,
    [auth0Sub, scope.organizationId],
  );
  return rows[0] ?? null;
}

export async function findUserForOrganization(scope: TenantScope, auth0Sub: string): Promise<GothamUser | null> {
  return findUserByAuth0Sub(scope, auth0Sub);
}

export async function upsertUser(input: { scope: TenantScope; auth0Sub: string; email: string; fullName: string; imageUrl?: string | null }): Promise<GothamUser> {
  requireTenantScope(input.scope);
  return withTransaction(async (client: PoolClient) => {
    const existing = await client.query<GothamUser>(
      `SELECT ${USER_COLUMNS} FROM users u JOIN organization_memberships m ON m.user_id = u.id
        WHERE (u.auth0_sub = $1 OR lower(u.email) = lower($2)) AND m.organization_id = $3 AND m.status = 'active' AND u.status = 'active'
        ORDER BY (u.auth0_sub = $1) DESC LIMIT 1 FOR UPDATE`,
      [input.auth0Sub, input.email, input.scope.organizationId],
    );
    if (existing.rows[0]) {
      const updated = await client.query<GothamUser>(
        `UPDATE users SET auth0_sub = $2, email = lower($3), full_name = $4, image_url = $5, updated_at = now()
          WHERE id = $1 RETURNING ${USER_COLUMNS_NO_ALIAS}`,
        [existing.rows[0].id, input.auth0Sub, input.email, input.fullName, input.imageUrl ?? null],
      );
      if (!updated.rows[0]) throw new Error("User update returned no row");
      return updated.rows[0];
    }
    const inserted = await client.query<GothamUser>(
      `INSERT INTO users (auth0_sub, email, full_name, image_url) VALUES ($1, lower($2), $3, $4) RETURNING ${USER_COLUMNS_NO_ALIAS}`,
      [input.auth0Sub, input.email, input.fullName, input.imageUrl ?? null],
    );
    if (!inserted.rows[0]) throw new Error("User insert returned no row");
    await client.query(
      `INSERT INTO organization_memberships (organization_id, user_id, role, status) VALUES ($1, $2, 'viewer', 'active') ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active'`,
      [input.scope.organizationId, inserted.rows[0].id],
    );
    return inserted.rows[0];
  });
}

export async function consumeCreditForScan(scope: TenantScope, userId: string, cost = 1, idempotencyKey?: string): Promise<GothamUser | null> {
  requireTenantScope(scope);
  return withTransaction(async (client: PoolClient) => {
    const membership = await client.query<{ user_id: string }>(`SELECT user_id FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`, [scope.organizationId, userId]);
    if (!membership.rows[0]) return null;
    if (idempotencyKey) {
      const existing = await client.query<{ user_id: string }>(`SELECT user_id FROM usage_events WHERE organization_id = $1 AND user_id = $2 AND idempotency_key = $3 LIMIT 1`, [scope.organizationId, userId, idempotencyKey]);
      if (existing.rows[0]) {
        const prior = await client.query<GothamUser>(`SELECT ${USER_COLUMNS_NO_ALIAS} FROM users WHERE id = $1 AND status = 'active' LIMIT 1`, [userId]);
        return prior.rows[0] ?? null;
      }
    }
    const updated = await client.query<GothamUser>(
      `UPDATE users SET credits = credits - $2, credits_used = credits_used + $2, scan_count = scan_count + 1, updated_at = now()
        WHERE id = $1 AND status = 'active' AND credits >= $2 RETURNING ${USER_COLUMNS_NO_ALIAS}`,
      [userId, cost],
    );
    if (!updated.rows[0]) return null;
    if (idempotencyKey) {
      await client.query(`INSERT INTO usage_events (user_id, organization_id, event_type, units, idempotency_key, metadata) VALUES ($1, $2, 'scan_credit_consumed', $3, $4, $5)`, [userId, scope.organizationId, cost, idempotencyKey, { idempotency_key: idempotencyKey }]);
    }
    return updated.rows[0];
  });
}

export async function activateTrial(scope: TenantScope, userId: string, trialCredits: number): Promise<GothamUser | null> {
  requireTenantScope(scope);
  const rows = await query<GothamUser>(
    `UPDATE users u SET credits = GREATEST(u.credits, $3), plan = 'trial', trial_used = true, updated_at = now()
      WHERE u.id = $1 AND u.status = 'active' AND u.trial_used = false
        AND EXISTS (SELECT 1 FROM organization_memberships m WHERE m.user_id = u.id AND m.organization_id = $2 AND m.status = 'active')
      RETURNING ${USER_COLUMNS}`,
    [userId, scope.organizationId, trialCredits],
  );
  return rows[0] ?? null;
}

export async function refundCreditForScan(scope: TenantScope, userId: string, cost = 1, idempotencyKey?: string): Promise<GothamUser | null> {
  requireTenantScope(scope);
  return withTransaction(async (client: PoolClient) => {
    const membership = await client.query<{ user_id: string }>(`SELECT user_id FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`, [scope.organizationId, userId]);
    if (!membership.rows[0]) return null;
    if (idempotencyKey) {
      const existing = await client.query<{ user_id: string }>(`SELECT user_id FROM usage_events WHERE organization_id = $1 AND user_id = $2 AND idempotency_key = $3 LIMIT 1`, [scope.organizationId, userId, idempotencyKey]);
      if (existing.rows[0]) return client.query<GothamUser>(`SELECT ${USER_COLUMNS_NO_ALIAS} FROM users WHERE id = $1 AND status = 'active' LIMIT 1`, [userId]).then((result) => result.rows[0] ?? null);
    }
    const result = await client.query<GothamUser>(
      `UPDATE users SET credits = credits + $3, credits_used = GREATEST(0, credits_used - $3), scan_count = GREATEST(0, scan_count - 1), updated_at = now()
        WHERE id = $1 AND status = 'active' RETURNING ${USER_COLUMNS_NO_ALIAS}`,
      [userId, scope.organizationId, cost],
    );
    if (result.rows[0] && idempotencyKey) await client.query(`INSERT INTO usage_events (user_id, organization_id, event_type, units, idempotency_key, metadata) VALUES ($1, $2, 'scan_credit_refunded', $3, $4, $5)`, [userId, scope.organizationId, cost, idempotencyKey, { idempotency_key: idempotencyKey }]);
    return result.rows[0] ?? null;
  });
}

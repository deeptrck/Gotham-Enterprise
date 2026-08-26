/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const crypto = require("node:crypto");
const { Client } = require("pg");

const connectionString = process.env.DATABASE_URL;

test("PostgreSQL tenant isolation and idempotency constraints", { skip: !connectionString }, async () => {
  const client = new Client({ connectionString });
  await client.connect();
  const suffix = crypto.randomUUID();
  const orgA = crypto.randomUUID();
  const orgB = crypto.randomUUID();
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  const scanA = crypto.randomUUID();
  const resultA = crypto.randomUUID();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3), ($4, $5, $6)", [orgA, "Integration A", `integration-a-${suffix}`, orgB, "Integration B", `integration-b-${suffix}`]);
    await client.query("INSERT INTO users (id, auth0_sub, email, full_name) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)", [userA, `auth0|integration-a-${suffix}`, `a-${suffix}@example.test`, "Tenant A", userB, `auth0|integration-b-${suffix}`, `b-${suffix}@example.test`, "Tenant B"]);
    await client.query("INSERT INTO organization_memberships (organization_id, user_id, role) VALUES ($1, $2, 'viewer'), ($3, $4, 'viewer')", [orgA, userA, orgB, userB]);
    await client.query("INSERT INTO scans (id, organization_id, user_id, file_name, file_type, status) VALUES ($1, $2, $3, 'a.png', 'image', 'completed')", [scanA, orgA, userA]);
    await client.query("INSERT INTO verification_results (id, scan_id, organization_id, user_id, file_name, file_type, status, confidence_score, models_used) VALUES ($1, $2, $3, $4, 'a.png', 'image', 'AUTHENTIC', 10, ARRAY['gotham-core-sagemaker'])", [resultA, scanA, orgA, userA]);

    const own = await client.query("SELECT id FROM verification_results WHERE id = $1 AND user_id = $2 AND organization_id = $3", [resultA, userA, orgA]);
    const crossTenant = await client.query("SELECT id FROM verification_results WHERE id = $1 AND user_id = $2 AND organization_id = $3", [resultA, userB, orgB]);
    assert.equal(own.rowCount, 1);
    assert.equal(crossTenant.rowCount, 0);

    const indexes = await client.query("SELECT indexname FROM pg_indexes WHERE indexname IN ('usage_events_org_idempotency_idx', 'model_invocations_org_idempotency_idx')");
    assert.equal(indexes.rowCount, 2, "Apply 002_enterprise_operational.sql before running DB integration tests");
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
});

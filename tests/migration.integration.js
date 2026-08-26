/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeUser, normalizeVerificationResult, uuidFor } = require("../scripts/migration-helpers");

test("migration IDs are deterministic and UUID-shaped", () => {
  const first = uuidFor("user", "mongo-user-1");
  assert.equal(first, uuidFor("user", "mongo-user-1"));
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first, uuidFor("user", "mongo-user-2"));
});

test("user migration normalizes Auth0 identity, email, defaults, and legacy mapping", () => {
  const user = normalizeUser({ _id: "mongo-user-1", auth0_sub: "auth0|abc", email: "BRYAN@DEEPTRACK.IO", name: "Bryan", credits: "25", trialUsed: 1 });
  assert.equal(user.auth0Sub, "auth0|abc");
  assert.equal(user.email, "bryan@deeptrack.io");
  assert.equal(user.fullName, "Bryan");
  assert.equal(user.credits, 25);
  assert.equal(user.trialUsed, true);
  assert.equal(user.legacyMongoId, "mongo-user-1");
});

test("verification migration coerces unsupported values safely and bounds confidence", () => {
  const result = normalizeVerificationResult({ _id: "mongo-result-1", userId: "mongo-user-1", fileType: "document", status: "UNKNOWN", confidenceScore: 250, modelsUsed: ["legacy", 7] });
  assert.equal(result.fileType, "image");
  assert.equal(result.status, "SUSPICIOUS");
  assert.equal(result.confidenceScore, 100);
  assert.deepEqual(result.modelsUsed, ["legacy", "7"]);
  assert.equal(result.id, normalizeVerificationResult({ _id: "mongo-result-1", userId: "mongo-user-1" }).id);
});

test("migration write contract is duplicate-safe", () => {
  const source = require("node:fs").readFileSync("scripts/migrate-mongo-to-postgres.js", "utf8");
  assert.match(source, /ON CONFLICT \(auth0_sub\) DO UPDATE/);
  assert.match(source, /ON CONFLICT \(scan_id\) DO UPDATE/);
  assert.match(source, /legacy_mongo_id/);
});

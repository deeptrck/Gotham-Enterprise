#!/usr/bin/env node

/**
 * Gotham MongoDB -> PostgreSQL migration utility.
 *
 * Safety: dry-run is the default. Use --apply only after reviewing counts and
 * taking a PostgreSQL backup. The script never drops MongoDB collections.
 */
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { Pool } = require("pg");
require("dotenv").config();

const apply = process.argv.includes("--apply");
const batchSize = 250;
const mongoUri = process.env.MONGODB_URI;
const postgresUrl = process.env.DATABASE_URL;
const mongoDatabase = process.env.MONGODB_DATABASE || undefined;

if (!mongoUri) throw new Error("MONGODB_URI is required");
if (!postgresUrl) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: postgresUrl, max: 5, idleTimeoutMillis: 10000 });
const { uuidFor, text, date, array, json, normalizeUser, normalizeVerificationResult } = require("./migration-helpers");

async function migrateUsers(db, stats) {
  const rows = await db.collection("users").find({}).batchSize(batchSize).toArray();
  for (const source of rows) {
    const normalized = normalizeUser(source);
    const values = [normalized.id, normalized.auth0Sub, normalized.email, normalized.fullName, normalized.imageUrl, normalized.credits, normalized.creditsUsed, normalized.scanCount, normalized.plan, normalized.trialUsed, date(source.createdAt), date(source.updatedAt), normalized.legacyMongoId];
    if (apply) await db.pg.query(`INSERT INTO users (id, auth0_sub, email, full_name, image_url, credits, credits_used, scan_count, plan, trial_used, created_at, updated_at, legacy_mongo_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (auth0_sub) DO UPDATE SET email=EXCLUDED.email, full_name=EXCLUDED.full_name, image_url=EXCLUDED.image_url, credits=EXCLUDED.credits, credits_used=EXCLUDED.credits_used, scan_count=EXCLUDED.scan_count, plan=EXCLUDED.plan, trial_used=EXCLUDED.trial_used, updated_at=EXCLUDED.updated_at`, values);
    stats.users += 1;
  }
}

async function migrateVerificationResults(db, stats) {
  const rows = await db.collection("verificationresults").find({}).batchSize(batchSize).toArray();
  for (const source of rows) {
    const normalized = normalizeVerificationResult(source);
    const userId = normalized.userId;
    const scanId = normalized.scanId;
    const resultId = normalized.id;
    const createdAt = date(source.createdAt || source.uploadedDate);
    const fileType = normalized.fileType;
    const status = normalized.status;
    const score = normalized.confidenceScore;
    if (apply) {
      await db.pg.query(`INSERT INTO scans (id, user_id, file_name, file_type, request_path, request_method, status, created_at, updated_at, legacy_mongo_id) VALUES ($1,$2,$3,$4,$5,$6,'completed',$7,$8,$9) ON CONFLICT (id) DO NOTHING`, [scanId, userId, text(source.fileName, "unknown"), fileType, source.requestPath || null, source.method || null, createdAt, date(source.updatedAt || createdAt), text(source.scanId || source._id)]);
      await db.pg.query(`INSERT INTO verification_results (id, scan_id, user_id, file_name, file_type, status, confidence_score, models_used, image_url, source_url, description, features, review_status, feedback_type, fc_analysis, proprietary_analysis, raw_model_payload, uploaded_at, created_at, updated_at, legacy_mongo_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) ON CONFLICT (scan_id) DO UPDATE SET status=EXCLUDED.status, confidence_score=EXCLUDED.confidence_score, models_used=EXCLUDED.models_used, proprietary_analysis=EXCLUDED.proprietary_analysis, raw_model_payload=EXCLUDED.raw_model_payload, updated_at=EXCLUDED.updated_at`, [resultId, scanId, userId, text(source.fileName, "unknown"), fileType, status, score, array(source.modelsUsed), source.imageUrl || null, source.url || null, source.description || null, array(source.features), source.reviewStatus || null, source.feedbackType || null, json(source.fcAnalysis), json(source.rdAnalysis), json(source), date(source.uploadedDate || createdAt), createdAt, date(source.updatedAt || createdAt), text(source._id)]);
    }
    stats.verificationresults += 1;
  }
}

async function migrateApiKeys(db, stats) {
  const rows = await db.collection("apikeys").find({}).batchSize(batchSize).toArray();
  for (const source of rows) {
    const userId = uuidFor("user", source.userId || source.auth0Sub || source.auth0Id || source._id);
    const rawKey = text(source.key || source.apiKey || source.token);
    const keyHash = source.keyHash || crypto.createHash("sha256").update(rawKey).digest("hex");
    const prefix = text(source.keyPrefix || rawKey.slice(0, 10) || source._id);
    if (apply) await db.pg.query(`INSERT INTO api_keys (id, user_id, key_prefix, key_hash, name, last_used_at, expires_at, revoked_at, created_at, legacy_mongo_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (key_hash) DO NOTHING`, [uuidFor("apikey", source._id), userId, prefix, keyHash, text(source.name, "Migrated API key"), source.lastUsedAt ? date(source.lastUsedAt) : null, source.expiresAt ? date(source.expiresAt) : null, source.revokedAt ? date(source.revokedAt) : null, date(source.createdAt), text(source._id)]);
    stats.apikeys += 1;
  }
}

async function migrateBugReports(db, stats) {
  const rows = await db.collection("bugreports").find({}).batchSize(batchSize).toArray();
  for (const source of rows) {
    if (apply) await db.pg.query(`INSERT INTO bug_reports (id, title, description, metadata, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`, [uuidFor("bugreport", source._id), text(source.title || source.subject || "Migrated bug report"), text(source.description || source.message || "Migrated legacy bug report"), json(source), date(source.createdAt), date(source.updatedAt || source.createdAt)]);
    stats.bugreports += 1;
  }
}

(async () => {
  const stats = { users: 0, verificationresults: 0, apikeys: 0, bugreports: 0, webhooks: 0 };
  const mongo = await mongoose.connect(mongoUri, { dbName: mongoDatabase, maxPoolSize: 5, serverSelectionTimeoutMS: 10000 });
  const db = { collection: (name) => mongo.connection.db.collection(name), pg: pool };
  console.log(apply ? "APPLY MODE: PostgreSQL writes enabled; MongoDB is read-only." : "DRY RUN: no PostgreSQL writes will be made.");
  await migrateUsers(db, stats);
  await migrateVerificationResults(db, stats);
  await migrateApiKeys(db, stats);
  // These generic migrations preserve source payloads until domain-specific fields are confirmed.
  await migrateBugReports(db, stats);
  // Webhook field mapping is intentionally deferred until the production webhook schema is confirmed.
  // No webhook records are modified by this utility.
  console.table(stats);
  await mongoose.disconnect();
  await pool.end();
})().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});

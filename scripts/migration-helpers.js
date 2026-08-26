const crypto = require("node:crypto");

function uuidFor(kind, id) {
  const hex = crypto.createHash("md5").update(`gotham:${kind}:${String(id)}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function text(value, fallback = "") {
  return value == null ? fallback : String(value);
}

function date(value) {
  return value ? new Date(value) : new Date();
}

function array(value) {
  return Array.isArray(value) ? value.map(String) : [];
}

function json(value) {
  return value == null ? null : JSON.stringify(value);
}

function normalizeUser(source) {
  return {
    id: uuidFor("user", source._id),
    auth0Sub: text(source.auth0Sub || source.auth0_sub || source.auth0Id || source.clerkId || source._id),
    email: text(source.email).toLowerCase(),
    fullName: text(source.fullName || source.name || source.email || "Unknown user"),
    imageUrl: source.imageUrl || null,
    credits: Number(source.credits || 0),
    creditsUsed: Number(source.creditsUsed || 0),
    scanCount: Number(source.scanCount || 0),
    plan: text(source.plan, "trial"),
    trialUsed: Boolean(source.trialUsed),
    legacyMongoId: text(source._id),
  };
}

function normalizeVerificationResult(source) {
  const legacyId = text(source._id);
  const fileType = ["image", "video", "audio"].includes(source.fileType) ? source.fileType : "image";
  const status = ["AUTHENTIC", "SUSPICIOUS", "DEEPFAKE"].includes(source.status) ? source.status : "SUSPICIOUS";
  return {
    id: uuidFor("verificationresult", legacyId),
    scanId: uuidFor("scan", source.scanId || legacyId),
    userId: uuidFor("user", source.userId),
    fileType,
    status,
    confidenceScore: Math.max(0, Math.min(100, Number(source.confidenceScore || 0))),
    modelsUsed: array(source.modelsUsed),
    legacyMongoId: legacyId,
  };
}

module.exports = { uuidFor, text, date, array, json, normalizeUser, normalizeVerificationResult };

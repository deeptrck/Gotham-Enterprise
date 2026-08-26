BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_mongo_id TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS legacy_mongo_id TEXT;
ALTER TABLE verification_results ADD COLUMN IF NOT EXISTS legacy_mongo_id TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS legacy_mongo_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS legacy_mongo_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_legacy_mongo_id_idx ON users (legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS scans_legacy_mongo_id_idx ON scans (legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS verification_results_legacy_mongo_id_idx ON verification_results (legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_legacy_mongo_id_idx ON api_keys (legacy_mongo_id) WHERE legacy_mongo_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  auth0_sub TEXT,
  email TEXT,
  access_type TEXT NOT NULL CHECK (access_type IN ('page_visit', 'api_call')),
  route_path TEXT NOT NULL,
  method TEXT,
  user_agent TEXT,
  ip INET,
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  url TEXT NOT NULL CHECK (url ~ '^https://'),
  secret_hash TEXT,
  events TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
  last_delivered_at TIMESTAMPTZ,
  last_status_code INTEGER,
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  response_status INTEGER,
  response_body TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_invocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider = 'aws_sagemaker'),
  endpoint_name TEXT NOT NULL,
  model_name TEXT,
  model_version TEXT,
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed', 'timed_out')),
  request_content_type TEXT,
  latency_ms INTEGER CHECK (latency_ms >= 0),
  error_code TEXT,
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS access_events_user_idx ON user_access_events (auth0_sub, created_at DESC);
CREATE INDEX IF NOT EXISTS access_events_route_idx ON user_access_events (route_path, created_at DESC);
CREATE INDEX IF NOT EXISTS bug_reports_status_idx ON bug_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS webhooks_org_idx ON webhooks (organization_id, status);
CREATE INDEX IF NOT EXISTS webhook_deliveries_pending_idx ON webhook_deliveries (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS model_invocations_scan_idx ON model_invocations (scan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS model_invocations_status_idx ON model_invocations (status, created_at DESC);

DROP TRIGGER IF EXISTS bug_reports_updated_at ON bug_reports;
CREATE TRIGGER bug_reports_updated_at BEFORE UPDATE ON bug_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS webhooks_updated_at ON webhooks;
CREATE TRIGGER webhooks_updated_at BEFORE UPDATE ON webhooks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Transactional idempotency for credit accounting and proprietary model execution.
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE model_invocations ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS usage_events_org_idempotency_idx
  ON usage_events (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS model_invocations_org_idempotency_idx
  ON model_invocations (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS usage_events_org_created_idx
  ON usage_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS model_invocations_org_created_idx
  ON model_invocations (organization_id, created_at DESC);

COMMENT ON COLUMN usage_events.idempotency_key IS 'Organization-scoped key preventing duplicate credit ledger entries.';
COMMENT ON COLUMN model_invocations.idempotency_key IS 'Organization-scoped key preventing duplicate SageMaker invocation records.';

COMMIT;

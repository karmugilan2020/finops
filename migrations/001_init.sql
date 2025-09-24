-- Enable extensions safely
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tenants
CREATE TABLE IF NOT EXISTS tenant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cloud accounts (optional for later)
CREATE TABLE IF NOT EXISTS cloud_account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('aws','gcp','azure')),
  name TEXT NOT NULL,
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assets
CREATE TABLE IF NOT EXISTS asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  account_id UUID REFERENCES cloud_account(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  service TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  region TEXT,
  state TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, resource_id)
);
CREATE INDEX IF NOT EXISTS idx_asset_tenant ON asset(tenant_id);
CREATE INDEX IF NOT EXISTS idx_asset_service ON asset(service);

-- Daily costs
CREATE TABLE IF NOT EXISTS cost_daily (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  usage_date DATE NOT NULL,
  service TEXT NOT NULL,
  resource_id TEXT,
  unblended_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  UNIQUE (tenant_id, provider, usage_date, service, resource_id)
);
CREATE INDEX IF NOT EXISTS idx_cost_tenant_date ON cost_daily(tenant_id, usage_date);

-- Policies (optional registry)
CREATE TABLE IF NOT EXISTS policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenant(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  spec JSONB NOT NULL,
  UNIQUE (tenant_id, key)
);

-- Recommendations
CREATE TABLE IF NOT EXISTS recommendation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  account_id UUID REFERENCES cloud_account(id) ON DELETE SET NULL,
  policy_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  service TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT now(),
  details JSONB NOT NULL,
  est_monthly_saving NUMERIC(18,6) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX IF NOT EXISTS idx_reco_tenant_status ON recommendation(tenant_id, status);

-- Seed a demo tenant so the worker has something to attach to
INSERT INTO tenant (slug, name)
VALUES ('demo', 'Demo Tenant')
ON CONFLICT (slug) DO NOTHING;


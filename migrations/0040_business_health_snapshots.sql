-- VentureRoom business health snapshots.
-- Stores founder-supplied monthly operating figures and powers evidence-based
-- runway, margin, acquisition-cost and trend diagnostics.

BEGIN;

CREATE TABLE IF NOT EXISTS business_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  recorded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  direct_costs NUMERIC(14,2) NOT NULL DEFAULT 0,
  operating_expenses NUMERIC(14,2) NOT NULL DEFAULT 0,
  cash_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  marketing_spend NUMERIC(14,2) NOT NULL DEFAULT 0,
  new_customers INTEGER NOT NULL DEFAULT 0,
  active_customers INTEGER NOT NULL DEFAULT 0,
  lost_customers INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_health_period_month CHECK (EXTRACT(DAY FROM period_start) = 1),
  CONSTRAINT business_health_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT business_health_nonnegative_money CHECK (
    revenue >= 0 AND direct_costs >= 0 AND operating_expenses >= 0
    AND cash_balance >= 0 AND marketing_spend >= 0
  ),
  CONSTRAINT business_health_nonnegative_customers CHECK (
    new_customers >= 0 AND active_customers >= 0 AND lost_customers >= 0
  ),
  CONSTRAINT business_health_notes_length CHECK (notes IS NULL OR char_length(notes) <= 2000),
  CONSTRAINT business_health_one_period_per_business UNIQUE (business_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_business_health_business_period
  ON business_health_snapshots (business_id, period_start DESC);

ALTER TABLE business_health_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON business_health_snapshots FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON business_health_snapshots TO service_role;

INSERT INTO schema_migrations (version, description)
VALUES ('0040', 'VentureRoom monthly business health snapshots and diagnostics')
ON CONFLICT (version) DO NOTHING;

COMMIT;

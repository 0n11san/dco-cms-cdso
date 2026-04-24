-- DCO CMS — Initial Schema
-- Run once against the target PostgreSQL database

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username    TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('superuser', 'regular')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions (managed by connect-pg-simple)
CREATE TABLE IF NOT EXISTS session (
  sid    VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expire_idx ON session (expire);

-- Contracts
CREATE TABLE IF NOT EXISTS contracts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_name   TEXT NOT NULL,
  delivery_order_number TEXT NOT NULL,
  vendor_pocs           JSONB NOT NULL DEFAULT '[]',
  costs                 JSONB NOT NULL DEFAULT '{}',
  por                   TEXT[] NOT NULL DEFAULT '{}',
  pop_begin_date        DATE,
  pop_end_date          DATE,
  line_items            JSONB NOT NULL DEFAULT '[]',
  documents             JSONB NOT NULL DEFAULT '{"dd250":"","rip":"","other":[]}',
  notes                 TEXT DEFAULT '',
  priority_order        INTEGER DEFAULT 9999,
  vehicle               TEXT DEFAULT '',
  metric_type           TEXT DEFAULT '',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action        TEXT NOT NULL,
  contract_id   UUID,
  contract_name TEXT,
  username      TEXT NOT NULL,
  role          TEXT NOT NULL,
  details       JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Renewals
CREATE TABLE IF NOT EXISTS renewals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending',
  notes        TEXT DEFAULT '',
  submitted_by TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Seed demo users (passwords: Dco2025!)
-- bcrypt hash of 'Dco2025!' with 12 rounds
INSERT INTO users (username, password_hash, role) VALUES
  ('APM',        '$2a$12$UAP2lV3E7gNwZvz8jo/CWe1hx4OKbPtrr9UFdDwSfQw8DqZnNFYnC', 'superuser'),
  ('ChiefNeely', '$2a$12$UAP2lV3E7gNwZvz8jo/CWe1hx4OKbPtrr9UFdDwSfQw8DqZnNFYnC', 'regular')
ON CONFLICT (username) DO NOTHING;

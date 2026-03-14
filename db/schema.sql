-- Minimal schema (idempotent)

CREATE TABLE IF NOT EXISTS addresses (
  id BIGSERIAL PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addresses_lower ON addresses ((lower(address)));

CREATE TABLE IF NOT EXISTS site_fetches (
  id BIGSERIAL PRIMARY KEY,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  url TEXT NOT NULL,
  html TEXT,
  json_responses JSONB,
  error TEXT
);

CREATE TABLE IF NOT EXISTS shutdown_snapshots (
  id BIGSERIAL PRIMARY KEY,
  address_id BIGINT NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shutdown_snapshots_address_id_scraped_at
  ON shutdown_snapshots(address_id, scraped_at DESC);

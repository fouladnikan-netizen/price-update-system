-- Operational store for the running app.
-- Catalog product rows are not seeded here. Daily prices keep Website product_code as text.
-- Missing amounts stay NULL. Zero is rejected. auto_publish stays false.

CREATE TABLE IF NOT EXISTS ops_sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  source_type text NOT NULL CHECK (
    source_type IN ('website', 'telegram', 'bale', 'excel', 'csv', 'pdf', 'image', 'manual')
  ),
  address text NOT NULL DEFAULT '',
  group_code text NOT NULL,
  category_code text NOT NULL,
  brand_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_coverage text NOT NULL CHECK (price_coverage IN ('factory', 'warehouse', 'both')),
  tax_mode text NOT NULL CHECK (tax_mode IN ('auto', 'excludes_vat', 'includes_vat')),
  intake_mode text NOT NULL CHECK (intake_mode IN ('manual', 'on_message', 'daily')),
  is_active boolean NOT NULL DEFAULT true,
  auto_publish boolean NOT NULL DEFAULT false CHECK (auto_publish = false),
  official_name text,
  official_url text,
  identity_status text NOT NULL CHECK (identity_status IN ('incomplete', 'suggested', 'confirmed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops_raw_inputs (
  id text PRIMARY KEY,
  source_id text,
  source_name text NOT NULL,
  group_code text NOT NULL,
  category_code text NOT NULL,
  price_coverage text,
  input_kind text NOT NULL CHECK (input_kind IN ('text', 'image', 'collect')),
  raw_text text NOT NULL DEFAULT '',
  image_url text,
  file_name text,
  received_at timestamptz NOT NULL,
  prompt_version text,
  can_publish boolean NOT NULL DEFAULT false CHECK (can_publish = false),
  error text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops_daily_prices (
  price_date text NOT NULL,
  product_code text NOT NULL,
  brand_id text NOT NULL DEFAULT '',
  brand_name text,
  factory_price numeric,
  warehouse_price numeric,
  factory_source text,
  warehouse_source text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (price_date, product_code, brand_id),
  CONSTRAINT ops_daily_product_code_present CHECK (btrim(product_code) <> ''),
  CONSTRAINT ops_daily_factory_not_zero CHECK (factory_price IS NULL OR factory_price > 0),
  CONSTRAINT ops_daily_warehouse_not_zero CHECK (warehouse_price IS NULL OR warehouse_price > 0)
);

CREATE TABLE IF NOT EXISTS ops_meta (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

INSERT INTO schema_migrations (id) VALUES ('002_ops_store')
ON CONFLICT (id) DO NOTHING;

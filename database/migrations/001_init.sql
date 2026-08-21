-- Local Price Update System schema
-- Source of truth: database/schema-design.md
-- Do not seed products. product_code comes only from Website.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'reviewer', 'publisher', 'operator')),
  status text NOT NULL CHECK (status IN ('active', 'disabled')),
  password_hash text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_uq UNIQUE (email)
);

CREATE TABLE product_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name_fa text NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_groups_code_uq UNIQUE (code),
  CONSTRAINT product_groups_name_fa_uq UNIQUE (name_fa)
);

CREATE TABLE product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES product_groups (id) ON DELETE RESTRICT,
  code text NOT NULL,
  name_fa text NOT NULL,
  brand_mode text NOT NULL CHECK (brand_mode IN ('branded', 'unbranded')),
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_categories_group_code_uq UNIQUE (group_id, code),
  CONSTRAINT product_categories_group_name_uq UNIQUE (group_id, name_fa)
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text NOT NULL,
  category_id uuid NOT NULL REFERENCES product_categories (id) ON DELETE RESTRICT,
  standard_name text NOT NULL,
  grade text,
  size_value text,
  thickness_mm numeric,
  length_label text,
  pipe_schedule text,
  form text,
  approx_weight numeric,
  weight_unit text,
  technical_attrs jsonb,
  is_active boolean NOT NULL DEFAULT true,
  source_of_code text NOT NULL CHECK (source_of_code = 'website'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_product_code_uq UNIQUE (product_code),
  CONSTRAINT products_product_code_present CHECK (btrim(product_code) <> '')
);

CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_brand_id text,
  group_id uuid NOT NULL REFERENCES product_groups (id) ON DELETE RESTRICT,
  category_id uuid NOT NULL REFERENCES product_categories (id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  legal_name text,
  aliases jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brands_scope_name_uq UNIQUE (group_id, category_id, display_name)
);

CREATE UNIQUE INDEX brands_website_brand_id_uq
  ON brands (website_brand_id)
  WHERE website_brand_id IS NOT NULL;

CREATE TABLE product_brand_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES product_categories (id) ON DELETE RESTRICT,
  brand_id uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  scope text NOT NULL CHECK (scope IN ('product', 'category')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_brand_tags_scope_product CHECK (
    (scope = 'product' AND product_id IS NOT NULL)
    OR (scope = 'category' AND product_id IS NULL)
  )
);

CREATE UNIQUE INDEX product_brand_tags_product_brand_uq
  ON product_brand_tags (product_id, brand_id)
  WHERE scope = 'product';

CREATE UNIQUE INDEX product_brand_tags_category_brand_uq
  ON product_brand_tags (category_id, brand_id)
  WHERE scope = 'category' AND product_id IS NULL;

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text NOT NULL CHECK (
    source_type IN ('website', 'telegram', 'bale', 'excel', 'csv', 'pdf', 'image', 'manual')
  ),
  address text,
  connector_key text NOT NULL,
  scope_group_id uuid REFERENCES product_groups (id),
  scope_category_id uuid REFERENCES product_categories (id),
  schedule_cron text,
  is_active boolean NOT NULL DEFAULT true,
  auto_publish boolean NOT NULL DEFAULT false,
  secret_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sources_identity_uq
  ON sources (source_type, address, connector_key)
  WHERE address IS NOT NULL;

CREATE TABLE raw_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources (id) ON DELETE RESTRICT,
  received_at timestamptz NOT NULL,
  external_message_id text,
  source_url text,
  message_link text,
  storage_key text,
  content_type text,
  raw_text text,
  checksum text,
  parser_version text,
  fetch_status text NOT NULL CHECK (fetch_status IN ('stored', 'ignored', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX raw_inputs_external_uq
  ON raw_inputs (source_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE UNIQUE INDEX raw_inputs_checksum_uq
  ON raw_inputs (source_id, checksum, received_at)
  WHERE external_message_id IS NULL AND checksum IS NOT NULL;

CREATE TABLE price_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_input_id uuid NOT NULL REFERENCES raw_inputs (id) ON DELETE RESTRICT,
  source_id uuid NOT NULL REFERENCES sources (id),
  product_id uuid REFERENCES products (id) ON DELETE RESTRICT,
  product_code_snapshot text,
  brand_id uuid REFERENCES brands (id) ON DELETE RESTRICT,
  price_type text NOT NULL CHECK (price_type IN ('factory', 'warehouse')),
  amount numeric,
  unit text,
  price_date date,
  match_status text NOT NULL CHECK (match_status IN ('unmatched', 'suggested', 'matched', 'rejected')),
  match_confidence numeric,
  is_suspicious boolean NOT NULL DEFAULT false,
  suspicious_reason text,
  extracted_payload jsonb,
  parser_version text NOT NULL,
  model_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_observations_amount_positive CHECK (amount IS NULL OR amount > 0),
  CONSTRAINT price_observations_matched_identity CHECK (
    match_status <> 'matched'
    OR (product_id IS NOT NULL AND btrim(coalesce(product_code_snapshot, '')) <> '')
  )
);

CREATE UNIQUE INDEX price_observations_repeat_branded_uq
  ON price_observations (raw_input_id, product_id, brand_id, price_type, price_date)
  WHERE brand_id IS NOT NULL;

CREATE UNIQUE INDEX price_observations_repeat_unbranded_uq
  ON price_observations (raw_input_id, product_id, price_type, price_date)
  WHERE brand_id IS NULL;

CREATE TABLE price_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES price_observations (id) ON DELETE RESTRICT,
  reviewer_user_id uuid NOT NULL REFERENCES users (id),
  decision text NOT NULL CHECK (
    decision IN ('approve_match', 'reject_match', 'approve_as_daily', 'reject_price', 'needs_info')
  ),
  override_product_id uuid REFERENCES products (id),
  override_brand_id uuid REFERENCES brands (id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE final_daily_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  product_code_snapshot text NOT NULL,
  brand_id uuid REFERENCES brands (id) ON DELETE RESTRICT,
  price_type text NOT NULL CHECK (price_type IN ('factory', 'warehouse')),
  price_date date NOT NULL,
  amount numeric NOT NULL,
  unit text NOT NULL,
  selected_observation_id uuid REFERENCES price_observations (id),
  final_source_id uuid NOT NULL REFERENCES sources (id),
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'blocked')),
  approved_by_user_id uuid REFERENCES users (id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT final_daily_prices_amount_positive CHECK (amount > 0),
  CONSTRAINT final_daily_prices_code_present CHECK (btrim(product_code_snapshot) <> ''),
  CONSTRAINT final_daily_prices_approved_actor CHECK (
    status <> 'approved' OR (approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX final_daily_prices_branded_uq
  ON final_daily_prices (product_id, brand_id, price_type, price_date)
  WHERE brand_id IS NOT NULL;

CREATE UNIQUE INDEX final_daily_prices_unbranded_uq
  ON final_daily_prices (product_id, price_type, price_date)
  WHERE brand_id IS NULL;

CREATE TABLE publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  final_daily_price_id uuid NOT NULL REFERENCES final_daily_prices (id) ON DELETE RESTRICT,
  product_code text NOT NULL,
  brand_id uuid REFERENCES brands (id),
  website_brand_id text,
  price_type text NOT NULL CHECK (price_type IN ('factory', 'warehouse')),
  amount numeric NOT NULL CHECK (amount > 0),
  unit text NOT NULL,
  price_date date NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'accepted', 'rejected', 'failed', 'cancelled')),
  auto_generated boolean NOT NULL DEFAULT false,
  requested_by_user_id uuid NOT NULL REFERENCES users (id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  website_operation_id text,
  response_payload jsonb,
  error_message text,
  CONSTRAINT publications_idempotency_uq UNIQUE (idempotency_key),
  CONSTRAINT publications_code_present CHECK (btrim(product_code) <> '')
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'worker', 'system')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  product_code text,
  before_state jsonb,
  after_state jsonb,
  request_id text,
  ip inet
);

CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, occurred_at);
CREATE INDEX audit_logs_product_idx ON audit_logs (product_code, occurred_at);

INSERT INTO schema_migrations (id) VALUES ('001_init')
ON CONFLICT (id) DO NOTHING;

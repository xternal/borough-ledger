// Borough Book's email alerts database. Kept as a TypeScript module so the web app bundles it without reading files at runtime.
export default /* sql */ `
-- Email alerts about pledges (docs/EMAIL_ALERTS.md). Postgres (Neon, London
-- region) in production; PGlite in development and tests.
--
-- Privacy rules (docs/PRIVACY.md, docs/DPIA_EMAIL.md):
-- * email addresses are stored only encrypted, plus an HMAC lookup hash;
--   no names, no IPs, no tracking;
-- * follows can reveal political opinions (UK GDPR Art. 9): they are never
--   shown individually or counted publicly;
-- * deleting is real deletion (ON DELETE CASCADE), not a flag.

CREATE TABLE IF NOT EXISTS schema_migration (
  id          TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- follow

CREATE TABLE IF NOT EXISTS subscription (
  id                   UUID PRIMARY KEY,
  address_enc          TEXT NOT NULL,             -- AES-256-GCM, base64 (iv|tag|ciphertext)
  address_hash         TEXT NOT NULL UNIQUE,      -- HMAC-SHA256(pepper, email:normalised address)
  consent_text_version TEXT NOT NULL,
  consent_at           TIMESTAMPTZ NOT NULL,
  confirm_token_hash   TEXT,                      -- double opt-in; cleared once confirmed
  confirmed_at         TIMESTAMPTZ,
  manage_token_hash    TEXT NOT NULL,             -- secret behind the manage link in every email
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_confirm_token ON subscription (confirm_token_hash) WHERE confirm_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS subscription_target (
  subscription_id UUID NOT NULL REFERENCES subscription(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('promise', 'all')),
  target_id       TEXT NOT NULL,                  -- promise id, or '*' for every pledge
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subscription_id, kind, target_id)
);
CREATE INDEX IF NOT EXISTS subscription_target_lookup ON subscription_target (kind, target_id);

-- What a follow request asked to add to a subscription that is already confirmed.
-- Nothing here is followed until the address's owner confirms it with the link
-- emailed to that address. Deleted after 7 days by the daily job.
CREATE TABLE IF NOT EXISTS pending_target (
  subscription_id    UUID NOT NULL REFERENCES subscription(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL CHECK (kind IN ('promise', 'all')),
  target_id          TEXT NOT NULL,
  confirm_token_hash TEXT NOT NULL,
  requested_at       TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (subscription_id, kind, target_id)
);
CREATE INDEX IF NOT EXISTS pending_target_token ON pending_target (confirm_token_hash);

-- ---------------------------------------------------------------- alerts

-- Every public pledge change the alerts job has seen, by its RSS item id. Public data only.
CREATE TABLE IF NOT EXISTS alert_item (
  guid        TEXT PRIMARY KEY,
  promise_id  TEXT NOT NULL,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  announced   BOOLEAN NOT NULL DEFAULT false
);

-- Which subscription has had which change, so a retry never sends twice. Pruned after 35 days.
CREATE TABLE IF NOT EXISTS delivery (
  guid            TEXT NOT NULL REFERENCES alert_item(guid) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscription(id) ON DELETE CASCADE,
  at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guid, subscription_id)
);

-- Development mail sink: what would have been sent. Never used in production.
CREATE TABLE IF NOT EXISTS mail_outbox (
  id         BIGSERIAL PRIMARY KEY,
  to_enc     TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body_text  TEXT NOT NULL,
  headers    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- abuse controls

-- Rate limiting without storing IPs: a random salt per day (deleted after the day),
-- and counts per HMAC(salt, ip). Once the salt is gone the hashes cannot be reversed.
CREATE TABLE IF NOT EXISTS daily_salt (
  day  DATE PRIMARY KEY,
  salt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_bucket (
  day         DATE NOT NULL,
  bucket_hash TEXT NOT NULL,
  action      TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, bucket_hash, action)
);

-- ALTCHA replay protection: a solved challenge is accepted once, until it expires.
CREATE TABLE IF NOT EXISTS altcha_used (
  signature  TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
`;

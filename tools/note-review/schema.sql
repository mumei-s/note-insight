PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_accounts (
  subject TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  entitlement TEXT NOT NULL DEFAULT 'pending'
    CHECK (entitlement IN ('pending', 'purchase', 'membership', 'revoked')),
  expires_at INTEGER,
  requested_at INTEGER NOT NULL,
  CHECK ((entitlement = 'membership' AND expires_at IS NOT NULL)
      OR (entitlement <> 'membership' AND expires_at IS NULL))
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  token_hash TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  note_id TEXT NOT NULL,
  proof_code TEXT NOT NULL,
  owner_proof INTEGER NOT NULL CHECK (owner_proof IN (0, 1)),
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  used_by TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS auth_challenge_expiry ON auth_challenges(expires_at);
CREATE INDEX IF NOT EXISTS auth_challenge_subject ON auth_challenges(subject);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  subject TEXT NOT NULL REFERENCES auth_accounts(subject),
  owner_proof INTEGER NOT NULL CHECK (owner_proof IN (0, 1)),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_session_subject ON auth_sessions(subject);
CREATE INDEX IF NOT EXISTS auth_session_expiry ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_rate_windows (
  bucket TEXT NOT NULL,
  ends_at INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (bucket, ends_at)
);
CREATE INDEX IF NOT EXISTS auth_rate_expiry ON auth_rate_windows(ends_at);

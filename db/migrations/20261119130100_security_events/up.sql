-- M6: durable sink for authentication/security events (login success/failure,
-- lockouts, API-token issuance/revocation, password changes, logouts). Separate
-- from audit_logs, which records admin mutations. user_id intentionally has no
-- foreign key so events survive account deletion; growth is bounded by the
-- maintenance retention sweep (SECURITY_EVENTS_RETENTION_MS).
CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id INTEGER,
  email TEXT,
  ip TEXT,
  details JSONB,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS security_events_event_type_idx ON security_events (event_type);
CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON security_events (created_at);
CREATE INDEX IF NOT EXISTS security_events_user_idx ON security_events (user_id);

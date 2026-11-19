-- M1: verification and password-reset tokens were stored in plaintext. Hash the
-- outstanding ones with SHA-256 (pgcrypto is enabled by the baseline) so a DB
-- read no longer yields usable account-takeover links. The app now stores and
-- compares only hashes; the raw token lives solely in the emailed link.
--
-- The guard skips values that are already a 64-char lowercase hex digest so the
-- statement never double-hashes. Raw tokens are base64url (43 chars) and cannot
-- match the guard.
UPDATE users
   SET verification_token = encode(digest(verification_token, 'sha256'), 'hex')
 WHERE verification_token IS NOT NULL
   AND verification_token !~ '^[0-9a-f]{64}$';

UPDATE users
   SET password_reset_token = encode(digest(password_reset_token, 'sha256'), 'hex')
 WHERE password_reset_token IS NOT NULL
   AND password_reset_token !~ '^[0-9a-f]{64}$';

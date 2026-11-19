-- SHA-256 is one-way: the raw tokens cannot be recovered. Rolling back
-- invalidates any outstanding verification/reset links (a safe failure mode —
-- users simply request a new link).
UPDATE users
   SET verification_token = NULL, verification_expires = NULL
 WHERE verification_token IS NOT NULL;

UPDATE users
   SET password_reset_token = NULL, password_reset_expires = NULL
 WHERE password_reset_token IS NOT NULL;

/**
 * Shared upper bound on a single chat/agent message.
 *
 * Server validation and every composer that renders a `maxLength` read this one
 * value, so the client cap can never drift from what the server accepts. Keep it
 * in `app/utils/` (asset-allowlisted) so UI modules don't have to reach into
 * `app/actions/`.
 */
export const MAX_MESSAGE_LENGTH = 5000

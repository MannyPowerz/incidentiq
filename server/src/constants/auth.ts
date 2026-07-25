// Auth tuning values, pulled into one file so each has exactly one place to change.
// REFRESH_TOKEN_TTL_MS was previously duplicated in tokens.ts AND twice in routes.ts —
// three copies of one number is how a cookie and its DB row end up expiring at different times.

export const SALT_ROUNDS = 12; // ADR 0004 — a step above OWASP's floor of 10
export const ACCESS_TOKEN_TTL = '15m'; // short-lived by design — refresh_tokens handles renewal
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — must match the cookie's maxAge

// ─── Server environment ───
// `react-router dev` and `react-router-serve` don't read `.env`, so the server
// loads it here, once, on import. A missing file is fine: variables can come
// from the real environment instead. Tests never read `.env`.
//
// Knock (see notifier.server.ts): KNOCK_SECRET_API_KEY, KNOCK_SIGNING_KEY
// (base64-encoded PEM), KNOCK_PUBLIC_API_KEY, KNOCK_FEED_CHANNEL_ID.

export function isUnderVitest() {
  return Boolean(process.env.VITEST);
}

if (!isUnderVitest()) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file; use the process environment as it is.
  }
}

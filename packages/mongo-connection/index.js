'use strict';

/**
 * Resolve MongoDB connection string from environment.
 *
 * MongoDB Atlas gives you a **connection string** — it is still a URI, e.g.
 * `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/dbname?retryWrites=true&w=majority`
 *
 * Use any one of these env vars (first non-empty wins):
 * - `MONGO_URI` — usual name in this repo (recommended for Secrets Manager JSON)
 * - `MONGODB_URI` — common alternate
 * - `MONGODB_ATLAS_URI` — explicit alias when pasting from Atlas “Connect” UI
 *
 * URL-encode the password in the string if it contains `@`, `#`, `:`, `/`, etc.
 *
 * @param {{ fallback?: string }} [options] — used only when all three vars are unset (e.g. local seed scripts)
 * @returns {string}
 */
function getMongoConnectionString(options = {}) {
  const raw =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGODB_ATLAS_URI ||
    options.fallback ||
    '';
  const uri = String(raw).trim();
  if (!uri) {
    throw new Error(
      'MongoDB connection string missing. Set MONGO_URI (or MONGODB_URI / MONGODB_ATLAS_URI) to your full string — including Atlas mongodb+srv://username:password@host/...',
    );
  }
  return uri;
}

module.exports = { getMongoConnectionString };

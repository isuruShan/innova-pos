'use strict';

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

function isBlank(v) {
  return v == null || String(v).trim() === '';
}

/**
 * Merge a flat JSON object into process.env.
 * @param {Record<string, unknown>} obj
 * @param {{ override?: boolean }} opts
 */
function applyJsonToProcessEnv(obj, opts = {}) {
  const override = Boolean(opts.override);
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 0;
  let n = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object' && v !== null) continue;
    const s = v == null ? '' : String(v);
    if (override || isBlank(process.env[k])) {
      process.env[k] = s;
      n += 1;
    }
  }
  return n;
}

/**
 * Fetch one Secrets Manager secret (JSON string) and merge into process.env.
 *
 * Trigger when any of these is set:
 * - AWS_SECRETS_MANAGER_SECRET_ID
 * - AWS_SECRETS_MANAGER_ARN
 * - AWS_SECRET_ID (alias)
 *
 * Merge mode (default `fill`): only sets keys that are blank in process.env (after dotenv).
 * Set AWS_SECRETS_MERGE_MODE=override to always overwrite from the secret.
 *
 * @returns {Promise<{ loaded: boolean, keysApplied?: number }>}
 */
async function loadAwsSecretsManagerEnv(options = {}) {
  const secretId =
    options.secretId ||
    process.env.AWS_SECRETS_MANAGER_SECRET_ID ||
    process.env.AWS_SECRETS_MANAGER_ARN ||
    process.env.AWS_SECRET_ID;

  if (!secretId || String(secretId).trim() === '') {
    return { loaded: false };
  }

  const region =
    options.region ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    'us-east-1';

  const mergeMode = String(
    options.mergeMode || process.env.AWS_SECRETS_MERGE_MODE || 'fill',
  ).toLowerCase();
  const override = mergeMode === 'override';

  const client = new SecretsManagerClient({ region });
  const res = await client.send(new GetSecretValueCommand({ SecretId: String(secretId).trim() }));

  const raw = res.SecretString != null ? res.SecretString : res.SecretBinary;
  if (raw == null) return { loaded: false };

  const str = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8');
  let parsed;
  try {
    parsed = JSON.parse(str);
  } catch {
    throw new Error(
      'AWS Secrets Manager value must be a JSON object (flat key/value strings) for consolidated env loading',
    );
  }

  const keysApplied = applyJsonToProcessEnv(parsed, { override });
  return { loaded: true, keysApplied };
}

module.exports = {
  loadAwsSecretsManagerEnv,
  applyJsonToProcessEnv,
};

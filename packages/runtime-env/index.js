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

function resolveSecretsProvider() {
  const explicit = String(process.env.SECRETS_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'azure' || explicit === 'aws' || explicit === 'none') return explicit;
  if (process.env.AZURE_KEY_VAULT_URL && String(process.env.AZURE_KEY_VAULT_URL).trim()) return 'azure';
  if (
    process.env.AWS_SECRETS_MANAGER_SECRET_ID ||
    process.env.AWS_SECRETS_MANAGER_ARN ||
    process.env.AWS_SECRET_ID
  ) {
    return 'aws';
  }
  return 'none';
}

function resolveMergeMode(options = {}) {
  return String(
    options.mergeMode ||
      process.env.SECRETS_MERGE_MODE ||
      process.env.AWS_SECRETS_MERGE_MODE ||
      'fill',
  ).toLowerCase();
}

/**
 * Fetch one Secrets Manager secret (JSON string) and merge into process.env.
 */
async function loadAwsSecretsManagerEnv(options = {}) {
  const secretId =
    options.secretId ||
    process.env.AWS_SECRETS_MANAGER_SECRET_ID ||
    process.env.AWS_SECRETS_MANAGER_ARN ||
    process.env.AWS_SECRET_ID;

  if (!secretId || String(secretId).trim() === '') {
    return { loaded: false, provider: 'aws' };
  }

  const region =
    options.region ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    'us-east-1';

  const override = resolveMergeMode(options) === 'override';

  const client = new SecretsManagerClient({ region });
  const res = await client.send(new GetSecretValueCommand({ SecretId: String(secretId).trim() }));

  const raw = res.SecretString != null ? res.SecretString : res.SecretBinary;
  if (raw == null) return { loaded: false, provider: 'aws' };

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
  return { loaded: true, provider: 'aws', keysApplied };
}

/**
 * Fetch one Key Vault secret (JSON string) and merge into process.env.
 *
 * Bootstrap on the VM (not inside the vault JSON):
 * - AZURE_KEY_VAULT_URL
 * - AZURE_KEY_VAULT_SECRET_NAME
 *
 * Auth: DefaultAzureCredential (system-assigned managed identity on Azure VM).
 */
async function loadAzureKeyVaultEnv(options = {}) {
  const vaultUrl = String(
    options.vaultUrl || process.env.AZURE_KEY_VAULT_URL || '',
  ).trim().replace(/\/$/, '');
  const secretName = String(
    options.secretName || process.env.AZURE_KEY_VAULT_SECRET_NAME || '',
  ).trim();

  if (!vaultUrl || !secretName) {
    return { loaded: false, provider: 'azure' };
  }

  const { DefaultAzureCredential } = require('@azure/identity');
  const { SecretClient } = require('@azure/keyvault-secrets');

  const override = resolveMergeMode(options) === 'override';
  const client = new SecretClient(vaultUrl, new DefaultAzureCredential());
  let secret;
  try {
    secret = await client.getSecret(secretName);
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.includes('Forbidden') || err?.statusCode === 403) {
      throw new Error(
        `Key Vault access denied for secret "${secretName}". Assign role "Key Vault Secrets User" ` +
          `to the VM managed identity (or your user for CLI) on vault ${vaultUrl}. ` +
          `App needs secrets/get, not keys/read. If you saw keys/read, use the Secrets blade or ` +
          '`az keyvault secret set`, not Keys. Wait 5–10 min after IAM changes.`,
        { cause: err },
      );
    }
    throw err;
  }
  const str = String(secret?.value || '').trim();
  if (!str) return { loaded: false, provider: 'azure' };

  let parsed;
  try {
    parsed = JSON.parse(str);
  } catch {
    throw new Error(
      'Azure Key Vault secret value must be a JSON object (flat key/value strings) for consolidated env loading',
    );
  }

  const keysApplied = applyJsonToProcessEnv(parsed, { override });
  return { loaded: true, provider: 'azure', keysApplied };
}

/**
 * Load remote secrets based on SECRETS_PROVIDER (or auto-detect from bootstrap env).
 *
 * SECRETS_PROVIDER=azure | aws | none
 * Auto: AZURE_KEY_VAULT_URL → azure; AWS_SECRETS_* → aws; else skip.
 */
async function loadSecretsEnv(options = {}) {
  const provider = String(options.provider || resolveSecretsProvider()).toLowerCase();

  if (provider === 'none') {
    return { loaded: false, provider: 'none' };
  }
  if (provider === 'azure') {
    return loadAzureKeyVaultEnv(options);
  }
  if (provider === 'aws') {
    return loadAwsSecretsManagerEnv(options);
  }
  throw new Error(`Unknown SECRETS_PROVIDER "${provider}". Use azure, aws, or none.`);
}

/**
 * Load secrets at process startup; exit on failure when a provider is configured.
 */
async function loadSecretsEnvOrExit(log = console) {
  const provider = resolveSecretsProvider();
  try {
    const res = await loadSecretsEnv();
    if (res.loaded) {
      log.log(`[runtime-env] Loaded ${res.keysApplied ?? 0} keys from ${res.provider} secrets`);
      if (!process.env.MONGO_URI && !process.env.MONGODB_URI && !process.env.MONGODB_ATLAS_URI) {
        log.warn('[runtime-env] MONGO_URI is not set after loading secrets — check Key Vault JSON');
      }
      return res;
    }

    if (provider !== 'none') {
      const hint =
        provider === 'azure'
          ? 'Set AZURE_KEY_VAULT_URL and AZURE_KEY_VAULT_SECRET_NAME in bootstrap.env (see bootstrap.env.example). VM identity needs Key Vault Secrets User.'
          : 'Set AWS_SECRETS_MANAGER_SECRET_ID and IAM GetSecretValue on the instance role.';
      const msg = `[runtime-env] ${provider} secrets were not loaded. ${hint}`;
      if (process.env.NODE_ENV === 'production') {
        log.error(msg);
        process.exit(1);
      }
      log.warn(msg);
    }
    return res;
  } catch (e) {
    log.error('[runtime-env] Failed to load secrets:', e.message);
    process.exit(1);
  }
}

module.exports = {
  applyJsonToProcessEnv,
  resolveSecretsProvider,
  loadSecretsEnv,
  loadSecretsEnvOrExit,
  loadAwsSecretsManagerEnv,
  loadAzureKeyVaultEnv,
};

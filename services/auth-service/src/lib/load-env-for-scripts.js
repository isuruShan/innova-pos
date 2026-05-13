'use strict';

const path = require('path');

/**
 * Load env the same way production apps do: dotenv from common paths, then
 * AWS Secrets Manager when AWS_SECRETS_MANAGER_SECRET_ID is set.
 *
 * Used by CLI scripts (seed, remove-super-admin) so they work on EC2 with only
 * Secrets Manager–backed config.
 */
async function loadEnvForScripts() {
  const roots = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '..', '..', '.env'),
    path.resolve(__dirname, '..', '..', '..', '..', '.env'),
  ];
  for (const p of roots) {
    require('dotenv').config({ path: p });
  }
  require('dotenv').config();

  try {
    const { loadAwsSecretsManagerEnv } = require('@innovapos/runtime-env');
    const res = await loadAwsSecretsManagerEnv();
    if (res.loaded) {
      console.log(`[env] Merged ${res.keysApplied ?? 0} keys from AWS Secrets Manager`);
    }
  } catch (e) {
    console.warn('[env] AWS Secrets Manager:', e.message);
  }
}

module.exports = { loadEnvForScripts };

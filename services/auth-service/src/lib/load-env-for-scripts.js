'use strict';

const path = require('path');

/**
 * Load env the same way production apps do: dotenv from common paths, then
 * cloud secrets when SECRETS_PROVIDER / Key Vault / Secrets Manager bootstrap is set.
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
    const { loadSecretsEnv } = require('@innovapos/runtime-env');
    const res = await loadSecretsEnv();
    if (res.loaded) {
      console.log(`[env] Merged ${res.keysApplied ?? 0} keys from ${res.provider} secrets`);
    }
  } catch (e) {
    console.warn('[env] Cloud secrets:', e.message);
  }
}

module.exports = { loadEnvForScripts };

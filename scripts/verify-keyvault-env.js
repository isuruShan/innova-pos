#!/usr/bin/env node
/**
 * Verify Key Vault bootstrap + secret load (run on the VM from repo root).
 *   pnpm install
 *   cp bootstrap.env.example bootstrap.env   # edit vault URL/name
 *   pnpm run verify:secrets
 */
'use strict';

const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');

function loadRuntimeEnv() {
  try {
    return require('@innovapos/runtime-env');
  } catch {
    return require(path.join(root, 'packages', 'runtime-env'));
  }
}

const bootstrapCandidates = [
  process.env.INNOVA_BOOTSTRAP_ENV,
  '/etc/innovapos/bootstrap.env',
  path.join(root, 'bootstrap.env'),
].filter(Boolean);

let bootstrapLoaded = false;
for (const filePath of bootstrapCandidates) {
  if (fs.existsSync(filePath)) {
    const result = require('dotenv').config({ path: filePath });
    console.log('bootstrap:', filePath, `(${result.parsed ? Object.keys(result.parsed).length : 0} keys)`);
    bootstrapLoaded = true;
    break;
  }
}
if (!bootstrapLoaded) {
  console.error('No bootstrap.env found. Create one from bootstrap.env.example:');
  bootstrapCandidates.forEach((p) => console.error('  -', p));
  process.exit(1);
}

console.log('AZURE_KEY_VAULT_URL:', process.env.AZURE_KEY_VAULT_URL || '(missing)');
console.log('AZURE_KEY_VAULT_SECRET_NAME:', process.env.AZURE_KEY_VAULT_SECRET_NAME || '(missing)');

if (!process.env.AZURE_KEY_VAULT_URL || !process.env.AZURE_KEY_VAULT_SECRET_NAME) {
  console.error('bootstrap.env must set AZURE_KEY_VAULT_URL and AZURE_KEY_VAULT_SECRET_NAME');
  process.exit(1);
}

const { loadSecretsEnv } = loadRuntimeEnv();

loadSecretsEnv()
  .then((res) => {
    console.log('loadSecretsEnv:', res);
    console.log('MONGO_URI set:', Boolean(process.env.MONGO_URI));
    console.log('JWT_SECRET set:', Boolean(process.env.JWT_SECRET));
    if (!res.loaded || !process.env.MONGO_URI) process.exit(1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

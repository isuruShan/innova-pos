#!/usr/bin/env node
/**
 * Verify Key Vault bootstrap + secret load (run on the VM from repo root).
 *
 *   pnpm install
 *   cp bootstrap.env.example bootstrap.env   # edit vault URL/name
 *   pnpm run verify:secrets
 *
 * Uses only Node built-ins for bootstrap.env (no dotenv). Azure SDK deps come from
 * packages/runtime-env after `pnpm install`.
 */
'use strict';

const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');

/** Minimal KEY=VALUE parser (comments and blank lines skipped). */
function loadEnvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
    count += 1;
  }
  return count;
}

function loadRuntimeEnv() {
  try {
    return require('@innovapos/runtime-env');
  } catch (err) {
    const runtimePath = path.join(root, 'packages', 'runtime-env');
    try {
      return require(runtimePath);
    } catch (err2) {
      console.error(
        'Could not load @innovapos/runtime-env. From the repo root run:\n  pnpm install\n  pnpm run verify:secrets',
      );
      if (err2.code === 'MODULE_NOT_FOUND') {
        console.error('Missing module:', err2.message.split('\n')[0]);
      }
      throw err2;
    }
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
    const keyCount = loadEnvFile(filePath);
    console.log('bootstrap:', filePath, `(${keyCount} keys)`);
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

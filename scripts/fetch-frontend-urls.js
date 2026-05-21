#!/usr/bin/env node
/**
 * Fetch frontend URL variables (VITE_*) from Azure Key Vault secret.
 * Used by deploy-production.sh to get build-time configuration.
 * 
 * Outputs shell export statements for eval in bash:
 *   export VITE_POS_URL="..."
 *   export VITE_ADMIN_URL="..."
 *   ...
 * 
 * Exit code 0 on success, non-zero on failure.
 */
'use strict';

const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');

/** Minimal KEY=VALUE parser (comments and blank lines skipped). */
function loadEnvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
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
  }
}

// Load bootstrap.env for Azure Key Vault configuration
const bootstrapCandidates = [
  process.env.INNOVA_BOOTSTRAP_ENV,
  '/etc/innovapos/bootstrap.env',
  path.join(root, 'bootstrap.env'),
].filter(Boolean);

let bootstrapLoaded = false;
for (const filePath of bootstrapCandidates) {
  if (fs.existsSync(filePath)) {
    loadEnvFile(filePath);
    bootstrapLoaded = true;
    break;
  }
}

if (!bootstrapLoaded) {
  process.stderr.write('ERROR: No bootstrap.env found\n');
  process.exit(1);
}

if (!process.env.AZURE_KEY_VAULT_URL || !process.env.AZURE_KEY_VAULT_SECRET_NAME) {
  process.stderr.write('ERROR: AZURE_KEY_VAULT_URL or AZURE_KEY_VAULT_SECRET_NAME not set\n');
  process.exit(1);
}

// Load runtime-env to fetch secrets
let loadSecretsEnv;
try {
  const runtimeEnv = require('@innovapos/runtime-env');
  loadSecretsEnv = runtimeEnv.loadSecretsEnv;
} catch (err) {
  const runtimePath = path.join(root, 'packages', 'runtime-env');
  try {
    const runtimeEnv = require(runtimePath);
    loadSecretsEnv = runtimeEnv.loadSecretsEnv;
  } catch (err2) {
    process.stderr.write('ERROR: Could not load @innovapos/runtime-env\n');
    process.exit(1);
  }
}

// Fetch secrets from Azure Key Vault
loadSecretsEnv()
  .then(() => {
    // Extract VITE_* variables and output as shell exports
    const viteVars = [
      'VITE_POS_URL',
      'VITE_ADMIN_URL',
      'VITE_PUBLIC_WEB_URL',
      'VITE_QR_ORDER_WEB_ORIGIN',
      'VITE_API_URL',
      'VITE_PUBLIC_WEB_API_URL',
      'VITE_QR_ORDER_API_URL',
    ];

    const exports = [];
    for (const varName of viteVars) {
      const value = process.env[varName];
      if (value) {
        // Escape quotes for shell safety
        const escaped = value.replace(/"/g, '\\"');
        exports.push(`export ${varName}="${escaped}"`);
      }
    }

    if (exports.length === 0) {
      process.stderr.write('WARNING: No VITE_* variables found in Key Vault secret\n');
      process.exit(1);
    }

    // Output shell export statements
    process.stdout.write(exports.join('\n') + '\n');
    process.exit(0);
  })
  .catch((err) => {
    process.stderr.write(`ERROR: Failed to fetch secrets: ${err.message}\n`);
    process.exit(1);
  });

'use strict';

const path = require('path');
const fs = require('fs');

/** Load vault bootstrap before cloudEnv is built (PM2 does not read your shell profile). */
function loadHostBootstrapEnv() {
  const candidates = [
    process.env.INNOVA_BOOTSTRAP_ENV,
    '/etc/innovapos/bootstrap.env',
    path.join(__dirname, 'bootstrap.env'),
  ].filter(Boolean);
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      require('dotenv').config({ path: filePath });
      console.log(`[ecosystem] Loaded bootstrap env from ${filePath}`);
      return filePath;
    }
  }
  return null;
}

loadHostBootstrapEnv();

/**
 * PM2 process configuration – all apps in the monorepo (POS, admin, public web,
 * QR table-order API, auth, upload).
 *
 * ── Cloud secrets & storage (config only — no code changes to switch) ─────
 * Every app calls loadSecretsEnv() at startup and merges one JSON secret into
 * process.env. Upload service uses STORAGE_PROVIDER for Azure Blob or AWS S3.
 *
 * Azure VM (recommended for full Azure):
 *   CLOUD_PROVIDER=azure   (or SECRETS_PROVIDER=azure / STORAGE_PROVIDER=azure)
 *   AZURE_KEY_VAULT_URL=https://YOUR-VAULT.vault.azure.net/
 *   AZURE_KEY_VAULT_SECRET_NAME=innovapos-production-env
 *   VM system-assigned managed identity → Key Vault Secrets User + Storage roles
 *
 * AWS EC2 (legacy):
 *   CLOUD_PROVIDER=aws
 *   AWS_SECRETS_MANAGER_SECRET_ID=your-secret-id
 *   IAM instance role: secretsmanager:GetSecretValue + S3
 *
 * Merge: SECRETS_MERGE_MODE=fill (default) or override
 * See docs/AZURE_PRODUCTION_DEPLOY.md
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Start / reload:
 *   pm2 start  ecosystem.config.cjs --env production
 *   pm2 reload ecosystem.config.cjs --env production   ← zero-downtime reload
 *   pm2 save                                           ← persist across reboots
 *   pm2 startup                                        ← generate systemd unit
 *
 * Logs:
 *   pm2 logs
 *   pm2 logs pos-server
 *   pm2 logs qr-order-server
 *
 * ── PM2: “Process N not found” / speedList pm2_env crash ───────────────────
 * The daemon’s idea of process IDs can get stale (crashes, kill -9, partial
 * restarts). Fix: reset the daemon and start clean from this repo root:
 *   pm2 kill
 *   cd ~/Projects/splitsecond-pos && pm2 start ecosystem.config.cjs --env production
 *   pm2 save
 * If `pm2 list` still throws, upgrade PM2 (`npm i -g pm2@latest`) or remove the
 * saved dump before starting: `mv ~/.pm2/dump.pm2 ~/.pm2/dump.pm2.bak`
 * Single-core / small VPS: use one POS worker to simplify IDs:
 *   PM2_INSTANCES=1 pm2 start ecosystem.config.cjs --env production
 */

// Bootstrap env on the host (not inside Key Vault / Secrets Manager JSON).
function cloudBootstrapEnv() {
  const cloud = String(process.env.CLOUD_PROVIDER || process.env.SECRETS_PROVIDER || 'azure').toLowerCase();
  if (cloud === 'aws') {
    return {
      SECRETS_PROVIDER: 'aws',
      STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'aws',
      AWS_REGION: process.env.AWS_REGION || 'us-east-1',
      AWS_DEFAULT_REGION: process.env.AWS_REGION || 'us-east-1',
      AWS_SECRETS_MANAGER_SECRET_ID: process.env.AWS_SECRETS_MANAGER_SECRET_ID || '',
      UPLOAD_SERVICE_URL: process.env.UPLOAD_SERVICE_URL || 'http://127.0.0.1:3002',
      AUDIT_SERVICE_URL: process.env.AUDIT_SERVICE_URL || 'http://127.0.0.1:3004',
    };
  }
  return {
    SECRETS_PROVIDER: 'azure',
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'azure',
    AZURE_KEY_VAULT_URL: process.env.AZURE_KEY_VAULT_URL || '',
    AZURE_KEY_VAULT_SECRET_NAME: process.env.AZURE_KEY_VAULT_SECRET_NAME || 'innovapos-production-env',
    UPLOAD_SERVICE_URL: process.env.UPLOAD_SERVICE_URL || 'http://127.0.0.1:3002',
    AUDIT_SERVICE_URL: process.env.AUDIT_SERVICE_URL || 'http://127.0.0.1:3004',
    };
}
const cloudEnv = cloudBootstrapEnv();
module.exports = {
  apps: [
    // ── POS App ──────────────────────────────────────────────────────────────
    {
      name: 'pos-server',
      script: './apps/pos/server/src/index.js',
      instances: process.env.PM2_INSTANCES || 2,
      exec_mode: 'cluster',
      max_memory_restart: '400M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        ...cloudEnv,
      },
      error_file: './logs/pos-error.log',
      out_file:   './logs/pos-out.log',
      log_file:   './logs/pos-combined.log',
      time: true,
      merge_logs: true,
    },

    // ── Admin Portal ─────────────────────────────────────────────────────────
    {
      name: 'admin-server',
      script: './apps/admin-portal/server/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 5001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001,
        ...cloudEnv,
      },
      error_file: './logs/admin-error.log',
      out_file:   './logs/admin-out.log',
      log_file:   './logs/admin-combined.log',
      time: true,
      merge_logs: true,
    },

    // ── Public Web ───────────────────────────────────────────────────────────
    {
      name: 'public-web-server',
      script: './apps/public-web/server/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 5002,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5002,
        ...cloudEnv,
      },
      error_file: './logs/public-web-error.log',
      out_file:   './logs/public-web-out.log',
      log_file:   './logs/public-web-combined.log',
      time: true,
      merge_logs: true,
    },

    // ── QR table-order API (public, no auth; build client to apps/qr-order/client/dist) ──
    {
      name: 'qr-order-server',
      script: './apps/qr-order/server/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 5010,
        // CORS_ORIGIN: 'http://localhost:5180',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5010,
        ...cloudEnv,
        // Set CORS_ORIGIN to the deployed guest SPA origin(s), comma-separated.
      },
      error_file: './logs/qr-order-error.log',
      out_file:   './logs/qr-order-out.log',
      log_file:   './logs/qr-order-combined.log',
      time: true,
      merge_logs: true,
    },

    // ── Auth Service ─────────────────────────────────────────────────────────
    {
      name: 'auth-service',
      script: './services/auth-service/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        ...cloudEnv,
      },
      error_file: './logs/auth-error.log',
      out_file:   './logs/auth-out.log',
      log_file:   './logs/auth-combined.log',
      time: true,
      merge_logs: true,
    },

    // ── Upload Service ───────────────────────────────────────────────────────
    {
      name: 'upload-service',
      script: './services/upload-service/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 3002,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
        ...cloudEnv,
      },
      error_file: './logs/upload-error.log',
      out_file:   './logs/upload-out.log',
      log_file:   './logs/upload-combined.log',
      time: true,
      merge_logs: true,
    },

    // ── Central Kitchen Server ───────────────────────────────────────────────
    {
      name: 'central-kitchen-server',
      script: './apps/central-kitchen/server/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 5005,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5005,
        ...cloudEnv,
      },
      error_file: './logs/central-kitchen-error.log',
      out_file:   './logs/central-kitchen-out.log',
      log_file:   './logs/central-kitchen-combined.log',
      time: true,
      merge_logs: true,
    },
  ],
};

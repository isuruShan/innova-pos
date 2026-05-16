'use strict';

/**
 * PM2 process configuration – all apps in the monorepo (POS, admin, public web,
 * QR table-order API, auth, upload).
 *
 * ── AWS Secrets Manager ────────────────────────────────────────────────────
 * Every app calls loadAwsSecretsManagerEnv() at startup, which fetches a
 * single JSON secret from AWS Secrets Manager and merges it into process.env.
 * The loader only fires when AWS_SECRETS_MANAGER_SECRET_ID is present.
 *
 * Recommended: attach an IAM role to the EC2 instance with permission:
 *   secretsmanager:GetSecretValue  on  arn:aws:secretsmanager:REGION:ACCT:secret:YOUR_SECRET_NAME-*
 * No static credentials are needed when running on EC2 with an instance role.
 *
 * If you are NOT using an instance role, create a minimal .env file in the
 * project root with just the bootstrap variables:
 *   AWS_REGION=us-east-1
 *   AWS_SECRETS_MANAGER_SECRET_ID=innovapos/production
 *   AWS_ACCESS_KEY_ID=AKIAxxxx          # only if no instance role
 *   AWS_SECRET_ACCESS_KEY=xxxx          # only if no instance role
 *
 * Merge behaviour (default: fill):
 *   - fill     → Secrets Manager only sets keys that are blank after dotenv
 *   - override → Secrets Manager always wins (set AWS_SECRETS_MERGE_MODE=override)
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

// ── Shared AWS bootstrap variables injected into every process ──────────────
// Change SECRET_ID to your actual Secrets Manager secret name or ARN.
// All other values (MONGO_URI, JWT_SECRET, etc.) come from the secret itself.
const awsEnv = {
  AWS_REGION:                      process.env.AWS_REGION || 'us-east-1',
  AWS_DEFAULT_REGION:              process.env.AWS_REGION || 'us-east-1',
  AWS_SECRETS_MANAGER_SECRET_ID:   process.env.AWS_SECRETS_MANAGER_SECRET_ID || 'ip-consolidated-secrets',
  // AWS_SECRETS_MERGE_MODE: 'fill',  // change to 'override' if the secret should always win
  /** Set to true/1 in Secrets Manager to skip HTTP rate limits (and Redis for limits). */
  DISABLE_RATE_LIMIT:              process.env.DISABLE_RATE_LIMIT || '',
};

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
        /** Failed login / forgot-password attempts per email (or IP) per 15 min window */
        RATE_LIMIT_AUTH_MAX: 60,
        ...awsEnv,
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
        ...awsEnv,
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
        ...awsEnv,
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
        ...awsEnv,
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
        ...awsEnv,
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
        ...awsEnv,
      },
      error_file: './logs/upload-error.log',
      out_file:   './logs/upload-out.log',
      log_file:   './logs/upload-combined.log',
      time: true,
      merge_logs: true,
    },
  ],
};

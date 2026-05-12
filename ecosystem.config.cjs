'use strict';

/**
 * PM2 process configuration – all apps in the monorepo.
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
 */
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
      },
      error_file: './logs/public-web-error.log',
      out_file:   './logs/public-web-out.log',
      log_file:   './logs/public-web-combined.log',
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
      },
      error_file: './logs/upload-error.log',
      out_file:   './logs/upload-out.log',
      log_file:   './logs/upload-combined.log',
      time: true,
      merge_logs: true,
    },
  ],
};

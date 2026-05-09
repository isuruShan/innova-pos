'use strict';

/**
 * PM2 process configuration for Burger Joint POS.
 *
 * Start/reload:
 *   pm2 start  ecosystem.config.cjs --env production
 *   pm2 reload ecosystem.config.cjs --env production   ← zero-downtime reload
 *   pm2 save                                           ← persist across reboots
 *   pm2 startup                                        ← generate systemd unit
 */
module.exports = {
  apps: [
    {
      name: 'burger-joint-pos',

      // Path relative to this file (project root)
      script: './server/src/index.js',

      // Number of instances.
      // 'max' uses all CPU cores; for a t3.micro (1 vCPU) use 1 or 2.
      instances: process.env.PM2_INSTANCES || 2,
      exec_mode: 'cluster',

      // Automatically restart if it exceeds this memory ceiling
      max_memory_restart: '400M',

      // Reload on uncaught exceptions (PM2 will attempt a graceful restart)
      exp_backoff_restart_delay: 100,
      max_restarts: 10,

      // Do NOT watch files in production — use explicit deploys instead
      watch: false,

      // Environment variables injected by default
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },

      // Environment variables injected with --env production
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // Log files (created under the project root; rotate with pm2-logrotate)
      error_file: './logs/pm2-error.log',
      out_file:   './logs/pm2-out.log',
      log_file:   './logs/pm2-combined.log',
      time: true,

      // Merge logs from all cluster instances into the same files
      merge_logs: true,
    },
  ],
};

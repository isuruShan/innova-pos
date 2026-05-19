#!/usr/bin/env node
/**
 * Verify Key Vault bootstrap + secret load (run on the VM from repo root).
 *   node scripts/verify-keyvault-env.js
 */
'use strict';

const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
for (const p of [
  process.env.INNOVA_BOOTSTRAP_ENV,
  '/etc/innovapos/bootstrap.env',
  path.join(root, 'bootstrap.env'),
]) {
  if (p && fs.existsSync(p)) {
    require('dotenv').config({ path: p });
    console.log('bootstrap:', p);
    break;
  }
}

require('dotenv').config({ path: path.join(root, '.env') });

const { loadSecretsEnv } = require('@innovapos/runtime-env');

loadSecretsEnv()
  .then((res) => {
    console.log('loadSecretsEnv:', res);
    console.log('MONGO_URI set:', Boolean(process.env.MONGO_URI));
    console.log('JWT_SECRET set:', Boolean(process.env.JWT_SECRET));
    if (!process.env.MONGO_URI) process.exit(1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

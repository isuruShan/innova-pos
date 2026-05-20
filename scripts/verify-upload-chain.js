#!/usr/bin/env node
/**
 * Diagnose POS → upload-service → storage connectivity (run on the VM from repo root).
 *
 *   pnpm install
 *   node scripts/verify-upload-chain.js
 *
 * Optional: JWT for full upload test
 *   POS_TOKEN=eyJ... node scripts/verify-upload-chain.js
 */
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const root = path.join(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const text = fs.readFileSync(filePath, 'utf8');
  let n = 0;
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
    n += 1;
  }
  return n;
}

for (const p of [
  process.env.INNOVA_BOOTSTRAP_ENV,
  '/etc/innovapos/bootstrap.env',
  path.join(root, 'bootstrap.env'),
]) {
  if (p && fs.existsSync(p)) {
    console.log('bootstrap:', p, `(${loadEnvFile(p)} keys)`);
    break;
  }
}

async function loadSecrets() {
  try {
    const { loadSecretsEnv } = require(path.join(root, 'packages', 'runtime-env'));
    const res = await loadSecretsEnv();
    console.log('secrets:', res);
    return res.loaded;
  } catch (e) {
    console.error('secrets load failed:', e.message);
    return false;
  }
}

function httpGet(url, headers = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'GET',
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`HTTP timeout after ${timeoutMs}ms: ${url}`));
    });
    req.on('error', reject);
    req.end();
  });
}

async function checkUploadServiceHealth(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, '')}/health`;
  const t0 = Date.now();
  const { status, body } = await httpGet(url);
  const ms = Date.now() - t0;
  console.log(`upload-service GET ${url} → ${status} (${ms}ms)`);
  if (status !== 200) {
    console.error('  body:', body.slice(0, 200));
    return false;
  }
  try {
    console.log('  ', JSON.parse(body));
  } catch {
    console.log('  ', body);
  }
  return true;
}

async function checkStorage() {
  const { resolveStorageProvider } = require(path.join(root, 'packages', 'object-storage'));
  const provider = resolveStorageProvider();
  console.log('storage provider:', provider || '(none)');

  if (!provider) {
    console.error(
      'FAIL: Set STORAGE_PROVIDER=azure and AZURE_STORAGE_ACCOUNT_NAME in Key Vault (remove stale AWS_S3_BUCKET if migrating).',
    );
    return false;
  }

  if (provider === 'aws') {
    console.log('  AWS_S3_BUCKET:', process.env.AWS_S3_BUCKET || '(missing)');
    if (process.env.SECRETS_PROVIDER === 'azure' || process.env.CLOUD_PROVIDER === 'azure') {
      console.warn(
        'WARN: Cloud is Azure but storage resolved to AWS — set STORAGE_PROVIDER=azure in Key Vault JSON.',
      );
    }
    return Boolean(process.env.AWS_S3_BUCKET);
  }

  const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const container =
    process.env.AZURE_STORAGE_CONTAINER_NAME || process.env.AZURE_STORAGE_CONTAINER || 'uploads';
  console.log('  AZURE_STORAGE_ACCOUNT_NAME:', account || '(missing)');
  console.log('  container:', container);

  if (!account) {
    console.error('FAIL: AZURE_STORAGE_ACCOUNT_NAME missing');
    return false;
  }

  const azure = require(path.join(root, 'packages', 'object-storage', 'providers', 'azure'));
  const testKey = `tenants/system/diagnostics/upload-chain-${Date.now()}.txt`;
  const payload = Buffer.from('upload-chain-test', 'utf8');

  try {
    const t0 = Date.now();
    await azure.warmupAzureStorage();
    console.log(`  Azure warmup (delegation key): ${Date.now() - t0}ms`);

    const t1 = Date.now();
    await azure.uploadObject(payload, testKey, 'text/plain');
    console.log(`  blob upload: ${Date.now() - t1}ms`);

    const t2 = Date.now();
    const url = await azure.getPresignedUrl(testKey, 300);
    console.log(`  SAS URL: ${Date.now() - t2}ms (${url.slice(0, 80)}...)`);

    await azure.deleteObject(testKey);
    console.log('  blob delete: ok');
    return true;
  } catch (e) {
    console.error('FAIL storage:', e.message);
    if (String(e.message).includes('Authorization') || String(e.message).includes('403')) {
      console.error(
        '  VM identity needs Storage Blob Data Contributor + Storage Blob Delegator on the storage account.',
      );
    }
    return false;
  }
}

async function checkPosToUpload(uploadUrl, token) {
  if (!token) {
    console.log('POS→upload: skipped (set POS_TOKEN=your_jwt to test POST /upload)');
    return true;
  }

  const FormData = require('form-data');
  const axios = require('axios');
  const form = new FormData();
  const buf = Buffer.from('pos-chain-test');
  form.append('file', buf, { filename: 'test.webp', contentType: 'image/webp' });
  form.append('type', 'menu');

  const url = `${uploadUrl.replace(/\/$/, '')}/upload`;
  const t0 = Date.now();
  try {
    const res = await axios.post(url, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    console.log(`POST ${url} → ${res.status} (${Date.now() - t0}ms)`, res.data?.key || res.data);
    return res.status >= 200 && res.status < 300;
  } catch (e) {
    console.error(`FAIL POS→upload (${Date.now() - t0}ms):`, e.response?.data?.message || e.message);
    if (e.code === 'ECONNREFUSED') {
      console.error('  upload-service not listening — pm2 list | grep upload');
    }
    return false;
  }
}

function resolveUploadServiceUrl() {
  const raw = String(process.env.UPLOAD_SERVICE_URL || 'http://127.0.0.1:3002').trim();
  try {
    const u = new URL(raw);
    if (u.hostname === 'localhost') u.hostname = '127.0.0.1';
    return u.toString().replace(/\/$/, '');
  } catch {
    return 'http://127.0.0.1:3002';
  }
}

async function main() {
  console.log('=== Upload chain diagnostic ===\n');
  await loadSecrets();

  const uploadUrl = resolveUploadServiceUrl();
  console.log('\nUPLOAD_SERVICE_URL:', uploadUrl);

  let ok = true;
  try {
    ok = (await checkUploadServiceHealth(uploadUrl)) && ok;
  } catch (e) {
    console.error('FAIL reach upload-service:', e.message);
    console.error('  Run: pm2 logs upload-service --lines 40');
    console.error('  Ensure UPLOAD_SERVICE_URL=http://127.0.0.1:3002 in Key Vault JSON');
    ok = false;
  }

  console.log('');
  ok = (await checkStorage()) && ok;

  console.log('');
  ok = (await checkPosToUpload(uploadUrl, process.env.POS_TOKEN)) && ok;

  console.log('\n===', ok ? 'PASS' : 'FAIL', '===');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

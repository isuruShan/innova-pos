'use strict';

const fs = require('fs');
const path = require('path');

// Mock Object Storage so we don't need real Azure/AWS credentials for testing
const objectStorage = require('@innovapos/object-storage');
const originalUploadObject = objectStorage.uploadObject;
let uploadMockCalled = [];

objectStorage.uploadObject = async (buffer, key, mimeType) => {
  uploadMockCalled.push({ key, mimeType, size: buffer.length });
  console.log(`[Mock Storage] Successfully uploaded to Key: "${key}" (mime: ${mimeType}, size: ${buffer.length} bytes)`);
  return key;
};

const { syncLogsToCloud } = require('../jobs/logSync');

async function run() {
  console.log('--- Starting LogSync Verification ---');

  // Create a temporary log directory
  const tempLogDir = path.join(__dirname, 'temp_test_logs');
  if (fs.existsSync(tempLogDir)) {
    fs.rmSync(tempLogDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempLogDir);

  const posLogDir = path.join(tempLogDir, 'pos-server');
  const adminLogDir = path.join(tempLogDir, 'admin-portal-server');
  fs.mkdirSync(posLogDir);
  fs.mkdirSync(adminLogDir);

  const now = Date.now();
  const oneDayAgo = now - 25 * 60 * 60 * 1000; // 25 hours ago

  // 1. Rotated POS log file (SHOULD be synced and deleted)
  const file1Path = path.join(posLogDir, 'combined-2026-05-30.log');
  fs.writeFileSync(file1Path, 'pos combined logs from yesterday');
  fs.utimesSync(file1Path, new Date(oneDayAgo), new Date(oneDayAgo));

  // 2. Active POS log file (SHOULD NOT be synced or deleted)
  const file2Path = path.join(posLogDir, 'combined-2026-05-31.log');
  fs.writeFileSync(file2Path, 'pos active combined logs from today');

  // 3. Rotated POS compressed log file (SHOULD be synced and deleted)
  const file3Path = path.join(posLogDir, 'error-2026-05-30.log.gz');
  fs.writeFileSync(file3Path, 'gzipped content from yesterday');
  fs.utimesSync(file3Path, new Date(oneDayAgo), new Date(oneDayAgo));

  // 4. Audit file (SHOULD NOT be synced or deleted)
  const file4Path = path.join(posLogDir, '.c90da9c203-audit.json');
  fs.writeFileSync(file4Path, '{"audit": "data"}');
  fs.utimesSync(file4Path, new Date(oneDayAgo), new Date(oneDayAgo));

  // 5. Root PM2 log file (SHOULD be synced and deleted)
  const file5Path = path.join(tempLogDir, 'public-web-combined.log');
  fs.writeFileSync(file5Path, 'public web server pm2 logs from yesterday');
  fs.utimesSync(file5Path, new Date(oneDayAgo), new Date(oneDayAgo));

  console.log('Seeded mock log files in temporary directory.');

  // Set environment variable to point to our temp directory
  process.env.LOG_DIR = tempLogDir;

  // Run the job
  console.log('\n--- Running syncLogsToCloud job ---');
  const result = await syncLogsToCloud(console);
  console.log('Job Result:', result);
  console.log('--- LogSync execution finished ---\n');

  // Verify results
  console.log('--- Verification Results ---');
  
  const file1Exists = fs.existsSync(file1Path);
  const file2Exists = fs.existsSync(file2Path);
  const file3Exists = fs.existsSync(file3Path);
  const file4Exists = fs.existsSync(file4Path);
  const file5Exists = fs.existsSync(file5Path);

  console.log(`Rotated log (combined-2026-05-30.log) deleted: ${!file1Exists ? 'PASS' : 'FAIL'}`);
  console.log(`Active log (combined-2026-05-31.log) kept: ${file2Exists ? 'PASS' : 'FAIL'}`);
  console.log(`Rotated compressed log (error-2026-05-30.log.gz) deleted: ${!file3Exists ? 'PASS' : 'FAIL'}`);
  console.log(`Audit file (.c90da9c203-audit.json) kept: ${file4Exists ? 'PASS' : 'FAIL'}`);
  console.log(`Rotated PM2 log (public-web-combined.log) deleted: ${!file5Exists ? 'PASS' : 'FAIL'}`);

  console.log(`\nUploaded items count: ${uploadMockCalled.length} (Expected: 3) -> ${uploadMockCalled.length === 3 ? 'PASS' : 'FAIL'}`);
  
  const keys = uploadMockCalled.map(u => u.key);
  console.log('Uploaded keys:', keys);
  
  const posKeyMatched = keys.some(k => k.startsWith('logs/pos-server/') && k.endsWith('combined-2026-05-30.log'));
  const gzKeyMatched = keys.some(k => k.startsWith('logs/pos-server/') && k.endsWith('error-2026-05-30.log.gz'));
  const pm2KeyMatched = keys.some(k => k.startsWith('logs/public-web/') && k.endsWith('public-web-combined.log'));

  console.log(`POS log uploaded to correct key path: ${posKeyMatched ? 'PASS' : 'FAIL'}`);
  console.log(`GZ log uploaded to correct key path: ${gzKeyMatched ? 'PASS' : 'FAIL'}`);
  console.log(`PM2 log uploaded to correct key path: ${pm2KeyMatched ? 'PASS' : 'FAIL'}`);

  // Restore mock and clean up
  objectStorage.uploadObject = originalUploadObject;
  fs.rmSync(tempLogDir, { recursive: true, force: true });
  console.log('\n--- LogSync Verification Finished ---');
}

run().catch((err) => {
  console.error('Test Execution failed:', err);
});

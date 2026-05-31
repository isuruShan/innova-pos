const fs = require('fs');
const path = require('path');
const { uploadObject } = require('@innovapos/object-storage');

/**
 * Recursively find all files in a directory
 * @param {string} dir - Directory path to scan
 * @returns {string[]} Array of absolute file paths
 */
function getAllFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}

/**
 * Daily job to collect completed/rotated log files and sync them to cloud storage.
 * Files modified within the last 24 hours are ignored to prevent cutting off active logs.
 * @param {object} logger - Winston logger instance
 */
async function syncLogsToCloud(logger) {
  const log = logger || console;
  const logDir = process.env.LOG_DIR || path.resolve(__dirname, '../../../../logs');
  
  log.info(`[LogSync] Starting log synchronization job. Scanning directory: ${logDir}`);
  
  if (!fs.existsSync(logDir)) {
    log.warn(`[LogSync] Log directory does not exist: ${logDir}. Skipping sync.`);
    return { success: true, uploaded: 0 };
  }

  const allFiles = getAllFiles(logDir);
  log.info(`[LogSync] Found total of ${allFiles.length} files in logs directory.`);

  const now = Date.now();
  const cutOffTime = now - 24 * 60 * 60 * 1000; // 24 hours ago
  
  let uploadedCount = 0;
  let failedCount = 0;

  for (const filePath of allFiles) {
    const filename = path.basename(filePath);
    
    // Ignore audit files and dotfiles
    if (filename.startsWith('.') || filename.includes('-audit.json')) {
      continue;
    }

    // Only process log or compressed files
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.log' && ext !== '.gz' && ext !== '.json') {
      continue;
    }

    try {
      const stat = fs.statSync(filePath);
      
      // Prevent syncing/deleting active files by verifying last modified time
      if (stat.mtimeMs > cutOffTime) {
        log.debug(`[LogSync] Skipping active file: ${filename} (modified recently)`);
        continue;
      }

      // Determine service name from directory structure or filename prefix
      const relative = path.relative(logDir, filePath);
      const parts = relative.split(path.sep);
      let serviceName = 'pm2';
      
      if (parts.length > 1) {
        // e.g. logs/pos-server/combined-2026-05-31.log -> serviceName = 'pos-server'
        serviceName = parts[0];
      } else {
        // e.g. logs/pos-combined.log -> serviceName = 'pos-server' (fallback regex parsing)
        const match = filename.match(/^([a-zA-Z0-9-]+)-(combined|error|out)\.log/);
        if (match) {
          serviceName = match[1];
        }
      }

      // Prepare key for upload: logs/{serviceName}/{year}/{month}/{day}/{filename}
      const fileDate = new Date(stat.mtimeMs);
      const year = fileDate.getFullYear();
      const month = String(fileDate.getMonth() + 1).padStart(2, '0');
      const day = String(fileDate.getDate()).padStart(2, '0');
      const blobKey = `logs/${serviceName}/${year}/${month}/${day}/${filename}`;

      // Determine mime type
      const mimeType = ext === '.gz' ? 'application/gzip' : (ext === '.json' ? 'application/json' : 'text/plain');

      log.info(`[LogSync] Archiving ${relative} (${(stat.size / 1024).toFixed(1)} KB) to cloud: ${blobKey}`);
      
      const buffer = fs.readFileSync(filePath);
      await uploadObject(buffer, blobKey, mimeType);
      
      // Delete local file after successful upload
      fs.unlinkSync(filePath);
      uploadedCount++;
    } catch (err) {
      log.error(`[LogSync] Failed to sync log file ${filename}: ${err.message}`, {
        stack: err.stack,
      });
      failedCount++;
    }
  }

  log.info(`[LogSync] Log synchronization job completed. Uploaded: ${uploadedCount}, Failed: ${failedCount}`);
  return { success: failedCount === 0, uploaded: uploadedCount, failed: failedCount };
}

module.exports = {
  syncLogsToCloud,
};

const fs = require('fs');
const path = require('path');

/**
 * Uploads a text/JSON file payload to either AWS S3, Azure Blob Storage, or falls back to local disk storage.
 * 
 * Configured via environment variables:
 * - AWS: S3_ARCHIVE_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 * - Azure: AZURE_STORAGE_CONNECTION_STRING, AZURE_CONTAINER_NAME
 * - Fallback: writes to `apps/pos/server/storage/archive/` (or simply `storage/archive/` relative to server root)
 * 
 * @param {string} fileName - File name to store as (e.g. "archive/store_XYZ_2026-05-30.json")
 * @param {string} fileContent - Stringified file contents
 * @param {object} logger - Winston logger instance
 */
async function archiveToCloud(fileName, fileContent, logger) {
  // S3 Credentials
  const s3Bucket = process.env.S3_ARCHIVE_BUCKET;
  const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const awsRegion = process.env.AWS_REGION || 'us-east-1';

  // Azure Credentials
  const azureConnString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const azureContainerName = process.env.AZURE_CONTAINER_NAME;

  try {
    // 1. Try S3 upload if configured
    if (s3Bucket && awsAccessKey && awsSecretKey) {
      logger.info(`[Archiver] Uploading ${fileName} to AWS S3 bucket: ${s3Bucket}`);
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const s3Client = new S3Client({
        region: awsRegion,
        credentials: {
          accessKeyId: awsAccessKey,
          secretAccessKey: awsSecretKey,
        },
      });

      await s3Client.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: fileName,
          Body: fileContent,
          ContentType: 'application/json',
        })
      );
      logger.info(`[Archiver] Successfully uploaded ${fileName} to S3`);
      return { provider: 's3', path: `${s3Bucket}/${fileName}` };
    }

    // 2. Try Azure Blob storage upload if configured
    if (azureConnString && azureContainerName) {
      logger.info(`[Archiver] Uploading ${fileName} to Azure Blob container: ${azureContainerName}`);
      const { BlobServiceClient } = require('@azure/storage-blob');
      const blobServiceClient = BlobServiceClient.fromConnectionString(azureConnString);
      const containerClient = blobServiceClient.getContainerClient(azureContainerName);
      
      // Ensure container exists
      await containerClient.createIfNotExists();
      
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      await blockBlobClient.upload(fileContent, fileContent.length, {
        blobHTTPHeaders: { blobContentType: 'application/json' },
      });
      logger.info(`[Archiver] Successfully uploaded ${fileName} to Azure Blob Storage`);
      return { provider: 'azure', path: `${azureContainerName}/${fileName}` };
    }

    // 3. Fallback to Local Filesystem Storage
    logger.warn(`[Archiver] No S3 or Azure credentials found. Falling back to local storage for file: ${fileName}`);
    const localDir = path.join(__dirname, '../../storage/archive');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const localPath = path.join(localDir, path.basename(fileName));
    fs.writeFileSync(localPath, fileContent, 'utf8');
    logger.info(`[Archiver] Successfully saved ${fileName} locally to ${localPath}`);
    return { provider: 'local', path: localPath };
  } catch (error) {
    logger.error(`[Archiver] Error during archival upload for ${fileName}`, {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = { archiveToCloud };

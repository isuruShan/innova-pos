const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.AWS_S3_BUCKET;

const clientConfig = { region: REGION };

// In dev with AWS_PROFILE set, the SDK picks it up automatically via
// the credential provider chain (profile → env vars → EC2 IMDS).
// No need to explicitly pass credentials here.
const s3 = new S3Client(clientConfig);

/**
 * Upload a buffer to S3.
 * @param {Buffer} buffer
 * @param {string} key       - e.g. tenants/abc123/menu/uuid.webp
 * @param {string} mimeType  - e.g. image/webp
 * @returns {Promise<string>} - The S3 key
 */
const uploadToS3 = async (buffer, key, mimeType) => {
  if (!BUCKET) throw new Error('AWS_S3_BUCKET is not configured');
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );
  return key;
};

/**
 * Generate a pre-signed GET URL (default 1 hour expiry).
 */
const getPresignedUrl = async (key, expiresInSeconds = 3600) => {
  if (!BUCKET) throw new Error('AWS_S3_BUCKET is not configured');
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
};

/**
 * Delete an object from S3.
 */
const deleteFromS3 = async (key) => {
  if (!BUCKET) throw new Error('AWS_S3_BUCKET is not configured');
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

module.exports = { uploadToS3, getPresignedUrl, deleteFromS3 };

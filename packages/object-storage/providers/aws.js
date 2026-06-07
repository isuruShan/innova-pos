'use strict';

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const BUCKET = process.env.AWS_S3_BUCKET;

const s3 = new S3Client({ region: REGION });

async function uploadObject(buffer, key, mimeType) {
  if (!BUCKET) throw new Error('AWS_S3_BUCKET is not configured');
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );
  return key;
}

async function getPresignedUrl(key, expiresInSeconds = 86400) {
  if (!BUCKET) throw new Error('AWS_S3_BUCKET is not configured');
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

async function deleteObject(key) {
  if (!BUCKET) throw new Error('AWS_S3_BUCKET is not configured');
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = { uploadObject, getPresignedUrl, deleteObject };

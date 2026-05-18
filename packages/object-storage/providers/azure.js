'use strict';

const {
  BlobServiceClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  SASProtocol,
} = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');

function accountName() {
  const name = String(process.env.AZURE_STORAGE_ACCOUNT_NAME || '').trim();
  if (!name) throw new Error('AZURE_STORAGE_ACCOUNT_NAME is not configured');
  return name;
}

function containerName() {
  return String(process.env.AZURE_STORAGE_CONTAINER_NAME || process.env.AZURE_STORAGE_CONTAINER || 'uploads').trim();
}

function blobServiceClient() {
  const account = accountName();
  return new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    new DefaultAzureCredential(),
  );
}

async function uploadObject(buffer, key, mimeType) {
  const client = blobServiceClient();
  const block = client.getContainerClient(containerName()).getBlockBlobClient(key);
  await block.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimeType },
  });
  return key;
}

async function getPresignedUrl(key, expiresInSeconds = 3600) {
  const account = accountName();
  const container = containerName();
  const client = blobServiceClient();
  const blobClient = client.getContainerClient(container).getBlobClient(key);

  const startsOn = new Date(Date.now() - 60 * 1000);
  const expiresOn = new Date(Date.now() + expiresInSeconds * 1000);
  const delegationKey = await client.getUserDelegationKey(startsOn, expiresOn);

  const sas = generateBlobSASQueryParameters(
    {
      containerName: container,
      blobName: key,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    },
    delegationKey,
    account,
  ).toString();

  return `${blobClient.url}?${sas}`;
}

async function deleteObject(key) {
  const client = blobServiceClient();
  await client.getContainerClient(containerName()).deleteBlob(key);
}

module.exports = { uploadObject, getPresignedUrl, deleteObject };

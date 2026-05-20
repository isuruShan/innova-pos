'use strict';

const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');

/** Same logic as @innovapos/object-storage/azureCredential (keep in sync). */
function createAzureCredential() {
  const clientId = String(process.env.AZURE_CLIENT_ID || '').trim();
  const useMiOnly =
    process.env.AZURE_USE_MANAGED_IDENTITY_ONLY === 'true' ||
    process.env.AZURE_USE_MANAGED_IDENTITY_ONLY === '1' ||
    (process.env.NODE_ENV === 'production' &&
      (process.env.SECRETS_PROVIDER === 'azure' ||
        process.env.CLOUD_PROVIDER === 'azure' ||
        String(process.env.AZURE_KEY_VAULT_URL || '').trim()));

  if (useMiOnly) {
    return clientId
      ? new ManagedIdentityCredential({ clientId })
      : new ManagedIdentityCredential();
  }

  return new DefaultAzureCredential({
    excludeAzureCliCredential: true,
    excludeAzurePowerShellCredential: true,
    excludeVisualStudioCodeCredential: true,
    excludeSharedTokenCacheCredential: true,
    excludeInteractiveBrowserCredential: true,
  });
}

module.exports = { createAzureCredential };

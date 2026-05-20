'use strict';

const { DefaultAzureCredential, ManagedIdentityCredential } = require('@azure/identity');

/**
 * Azure VM / App Service: use managed identity only in production to avoid
 * DefaultAzureCredential probing Azure CLI, VS Code, etc. (often ~30s before MI).
 */
function createAzureCredential() {
  const clientId = String(process.env.AZURE_CLIENT_ID || '').trim();
  const useMiOnly =
    process.env.AZURE_USE_MANAGED_IDENTITY_ONLY === 'true' ||
    process.env.AZURE_USE_MANAGED_IDENTITY_ONLY === '1' ||
    (process.env.NODE_ENV === 'production' &&
      (process.env.STORAGE_PROVIDER === 'azure' ||
        process.env.SECRETS_PROVIDER === 'azure' ||
        process.env.CLOUD_PROVIDER === 'azure' ||
        String(process.env.AZURE_STORAGE_ACCOUNT_NAME || '').trim()));

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

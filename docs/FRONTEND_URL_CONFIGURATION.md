# Frontend URL Configuration

## Problem
Frontend apps need to know the URLs of other apps for cross-app navigation (e.g., Admin Portal → POS, POS → QR Order). These URLs are baked into the client bundles at build time using `VITE_*` environment variables.

## Solution
Store frontend URLs in **Azure Key Vault** alongside other secrets, so they can be easily updated without editing code.

---

## Setup Instructions

### 1. Add Frontend URLs to Azure Key Vault Secret

Your Azure Key Vault secret (e.g., `innovapos-production-env`) should contain **both**:
- Server runtime variables (MONGO_URI, JWT_SECRET, SMTP_*, etc.)
- Frontend build-time URLs (VITE_* variables)

**Required VITE_* variables:**
```json
{
  "MONGO_URI": "mongodb://...",
  "JWT_SECRET": "...",
  "VITE_POS_URL": "https://pos.yourdomain.com",
  "VITE_ADMIN_URL": "https://admin.yourdomain.com",
  "VITE_PUBLIC_WEB_URL": "https://www.yourdomain.com",
  "VITE_QR_ORDER_WEB_ORIGIN": "https://order.yourdomain.com"
}
```

**Optional VITE_* variables:**
```json
{
  "VITE_API_URL": "https://pos.yourdomain.com/api",
  "VITE_PUBLIC_WEB_API_URL": "https://www.yourdomain.com/api",
  "VITE_QR_ORDER_API_URL": "https://order.yourdomain.com/api"
}
```

### 2. Update Azure Key Vault Secret

**Using Azure Portal:**
1. Go to your Key Vault (e.g., `cafinity-dev-key`)
2. Navigate to **Secrets** → Select your secret (e.g., `innovapos-production-env`)
3. Click **New Version**
4. Add/update the VITE_* variables in the JSON value
5. Click **Create**

**Using Azure CLI:**
```bash
# Get current secret value
az keyvault secret show --vault-name cafinity-dev-key --name innovapos-production-env --query value -o tsv > secret.json

# Edit secret.json to add VITE_* variables

# Update secret
az keyvault secret set --vault-name cafinity-dev-key --name innovapos-production-env --file secret.json
```

### 3. Verify Configuration

On your production server:

```bash
cd /path/to/splitsecond-pos

# Test fetching secrets (should show VITE_* variables)
node scripts/fetch-frontend-urls.js

# Run deployment (will use Key Vault values)
./scripts/deploy-production.sh
```

---

## How It Works

### During Deployment

1. **deploy-production.sh** loads `bootstrap.env` (or `/etc/innovapos/bootstrap.env`)
2. If `AZURE_KEY_VAULT_URL` is set, runs **fetch-frontend-urls.js** to get VITE_* variables
3. Exports VITE_* as environment variables
4. Verifies required variables are set
5. Builds client apps with these URLs baked into the bundles

### At Runtime (Browser)

Frontend apps use `@innovapos/app-urls` package which reads:
- `VITE_POS_URL` → `getPosUrl()`
- `VITE_ADMIN_URL` → `getAdminUrl()`
- `VITE_PUBLIC_WEB_URL` → `getPublicWebUrl()`
- `VITE_QR_ORDER_WEB_ORIGIN` → `getQrOrderWebOrigin()`

These functions provide the URLs for cross-app navigation.

---

## Alternative: Using deploy.env (Without Key Vault)

If you don't want to use Azure Key Vault, create a `deploy.env` file in the repo root:

```bash
# deploy.env
VITE_POS_URL=https://pos.yourdomain.com
VITE_ADMIN_URL=https://admin.yourdomain.com
VITE_PUBLIC_WEB_URL=https://www.yourdomain.com
VITE_QR_ORDER_WEB_ORIGIN=https://order.yourdomain.com
```

The deploy script will use this file if it exists (takes priority over Key Vault).

---

## Troubleshooting

### Links still go to localhost
- Verify VITE_* variables are in Azure Key Vault secret
- Check that `bootstrap.env` has correct `AZURE_KEY_VAULT_URL` and `AZURE_KEY_VAULT_SECRET_NAME`
- Run deployment again to rebuild with new URLs
- Clear browser cache

### Deploy script fails with "Required frontend URL variables not set"
- Add VITE_* variables to Azure Key Vault secret OR
- Create `deploy.env` in repo root with the required URLs

### How to check what URLs are currently baked in?
After building, check the client bundle:
```bash
grep -r "VITE_POS_URL" apps/pos/client/dist/
```

### Using different URLs per environment
- Dev: Use `.env` files in each client app (localhost URLs)
- Production: Use Azure Key Vault or `deploy.env` (production domain URLs)
- The build process will use environment variables to override `.env` files

---

## Files Changed

- [scripts/deploy-production.sh](../scripts/deploy-production.sh) - Fetches and validates VITE_* variables
- [scripts/fetch-frontend-urls.js](../scripts/fetch-frontend-urls.js) - Extracts VITE_* from Key Vault
- [bootstrap.env.example](../bootstrap.env.example) - Documents Key Vault secret structure
- [deploy.env.example](../deploy.env.example) - Shows alternative configuration method

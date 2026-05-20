# Run Splitsecond POS on Azure VM (Key Vault + Blob Storage)

This guide covers a **full Azure production** setup. The application picks **secrets** and **file storage** from environment variables only — no code changes when switching between Azure and AWS.

## Configuration model

| Variable | Azure production | AWS (legacy EC2) |
|----------|------------------|------------------|
| `CLOUD_PROVIDER` or `SECRETS_PROVIDER` | `azure` | `aws` |
| `STORAGE_PROVIDER` | `azure` | `aws` |
| Secrets bootstrap | `AZURE_KEY_VAULT_URL`, `AZURE_KEY_VAULT_SECRET_NAME` | `AWS_SECRETS_MANAGER_SECRET_ID`, `AWS_REGION` |
| Storage | `AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_STORAGE_CONTAINER_NAME` | `AWS_S3_BUCKET`, `AWS_REGION` |

**On the VM (bootstrap only)** — small env file or `/etc/environment`:

```bash
CLOUD_PROVIDER=azure
AZURE_KEY_VAULT_URL=https://cafinity-dev-key.vault.azure.net/
AZURE_KEY_VAULT_SECRET_NAME=innovapos-production-env
```

**Inside Key Vault** — one secret whose value is JSON (copy from `secrets.example.json`, fill real values):

- `MONGO_URI`, `JWT_SECRET`, `INTERNAL_SERVICE_KEY`, URLs, mail, etc.
- `STORAGE_PROVIDER`: `azure`
- `AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_STORAGE_CONTAINER_NAME`
- Do **not** put `AZURE_KEY_VAULT_URL` inside the vault (chicken-and-egg).

At startup each Node process runs `loadSecretsEnv()` → merges JSON into `process.env`. The upload service uses `STORAGE_PROVIDER` → Azure Blob or S3.

---

## Step 1 — Azure resources

1. **Resource group** (e.g. `rg-innovapos-prod`).
2. **Linux VM** (Ubuntu 22.04+), outbound HTTPS for npm/MongoDB Atlas.
3. **Key Vault** (RBAC enabled).
4. **Storage account** + **blob container** (e.g. `uploads`, private access).
5. Optional: **Application Gateway** or **NGINX** on the VM for TLS.

---

## Step 2 — Managed identity on the VM

1. VM → **Identity** → **System assigned** → **On** → Save. Note the **Object (principal) ID**.
2. Key Vault → **Access control (IAM)** → **Add role assignment**:
   - **Key Vault Secrets User** → assign to the VM identity.
3. Storage account → **Access control (IAM)**:
   - **Storage Blob Data Contributor** → VM identity (upload/delete blobs).
   - **Storage Blob Delegator** → VM identity (generate read SAS URLs for images).

No `AZURE_CLIENT_SECRET` on the VM when using system-assigned identity — `DefaultAzureCredential` uses the VM metadata service.

---

## Step 3 — Insert secrets into Key Vault

### Portal

1. Open your Key Vault → **Secrets** → **Generate/Import**.
2. **Name:** `innovapos-production-env` (must match `AZURE_KEY_VAULT_SECRET_NAME`).
3. **Value:** paste one JSON object (minified). Start from repo root `secrets.example.json`:

```json
{
  "NODE_ENV": "production",
  "SECRETS_PROVIDER": "azure",
  "STORAGE_PROVIDER": "azure",
  "MONGO_URI": "mongodb+srv://...",
  "JWT_SECRET": "...",
  "INTERNAL_SERVICE_KEY": "...",
  "UPLOAD_SERVICE_URL": "http://127.0.0.1:3002",
  "CORS_ORIGIN": "https://pos.example.com,https://admin.example.com",
  "AZURE_STORAGE_ACCOUNT_NAME": "yourstorageaccount",
  "AZURE_STORAGE_CONTAINER_NAME": "uploads",
  "EMAIL_FROM": "...",
  "EMAIL_APP_PASSWORD": "..."
}
```

4. **Create**. To rotate: add a **new version** of the same secret name, then `pm2 reload`.

### Azure CLI

```bash
az login
az account set --subscription "<subscription-id>"

# Local file secrets.production.json (gitignored) — from secrets.example.json
az keyvault secret set \
  --vault-name cafinity-dev-key \
  --name innovapos-production-env \
  --file secrets.production.json
```

### Verify (on the VM, after bootstrap env is set)

```bash
cd /path/to/splitsecond-pos
node -e "require('@innovapos/runtime-env').loadSecretsEnv().then(r=>console.log(r)).catch(e=>console.error(e))"
```

---

## Step 4 — Blob container

1. Storage account → **Containers** → **+ Container** → name `uploads` (or match `AZURE_STORAGE_CONTAINER_NAME`).
2. **Public access level:** Private.
3. Ensure VM identity has **Storage Blob Data Contributor** and **Storage Blob Delegator** on the storage account (or container scope).

Object keys stay the same shape as before: `tenants/{tenantId}/menu/{uuid}.webp`.

---

## Step 5 — Install app on the VM

Same as EC2: **Node 20 LTS** (recommended), pnpm, PM2, git clone.

**Do not use Node 24 for Vite dev** until Rolldown fully supports it — production `vite build` also needs Rolldown native bindings.

```bash
sudo apt update && sudo apt install -y git curl
# Node 20 LTS (example via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should show v20.x

corepack enable
corepack prepare pnpm@9.15.0 --activate
```

### Vite / Rolldown: `Cannot find @rolldown/binding-linux-x64-gnu`

This means `node_modules` was installed on another OS or optional deps were skipped. **Always install on the VM:**

```bash
cd /path/to/innova-pos
chmod +x scripts/ensure-native-bindings.sh
./scripts/ensure-native-bindings.sh
```

Or manually:

```bash
rm -rf node_modules apps/*/client/node_modules packages/*/node_modules
pnpm install
```

Never copy `node_modules` from your laptop to the VM.

**Production** only needs `pnpm run build` once per deploy (via `deploy-production.sh`), not `pnpm dev`.

Bootstrap file on the VM — **required for PM2** (shell `export` alone is not enough):

```bash
sudo mkdir -p /etc/innovapos
sudo cp bootstrap.env.example /etc/innovapos/bootstrap.env
sudo nano /etc/innovapos/bootstrap.env
```

Contents:

```bash
CLOUD_PROVIDER=azure
AZURE_KEY_VAULT_URL=https://cafinity-dev-key.vault.azure.net/
AZURE_KEY_VAULT_SECRET_NAME=innovapos-production-env
```

Or copy the same file to `~/InnovaSolution/innova-pos/bootstrap.env` in the repo root.

`ecosystem.config.cjs` loads `bootstrap.env` automatically before starting apps.

Verify Key Vault + `MONGO_URI` on the VM (install workspace deps first):

```bash
cd ~/InnovaSolution/innova-pos
pnpm install
cp bootstrap.env.example bootstrap.env   # or use /etc/innovapos/bootstrap.env
# edit AZURE_KEY_VAULT_URL and AZURE_KEY_VAULT_SECRET_NAME
pnpm run verify:secrets
```

You should see `bootstrap: ... (N keys)`, `loadSecretsEnv: { loaded: true, ... }`, and `MONGO_URI set: true`.

If you see `Cannot find module '@innovapos/runtime-env'`, run `pnpm install` at the repo root (do not copy `node_modules` from another machine).

---

## Step 5b — Vite build URLs (including table QR codes)

`VITE_*` variables are **baked into the browser bundle at `pnpm run build`**. Key Vault / PM2 env does **not** update an already-built POS client.

Café table QR codes in the POS manager need the **guest order app origin** (`qr-order-server`, port **5010** by default) — **never** the POS URL (`:5000`).

```bash
cd ~/InnovaSolution/innova-pos
cp deploy.env.example deploy.env
nano deploy.env
```

Example for a single public IP (replace with your VM IP or `https://order.yourdomain.com`):

```bash
VITE_API_URL=http://3.210.65.252:5000/api
VITE_ADMIN_URL=http://3.210.65.252:5001
VITE_PUBLIC_WEB_API_URL=http://3.210.65.252:5002
VITE_QR_ORDER_WEB_ORIGIN=http://3.210.65.252:5010
```

Open **NSG / firewall** for **5010** if guests scan QR on phones. Rebuild after any URL change:

```bash
source deploy.env
pnpm --filter @pos/client run build
pm2 reload ecosystem.config.cjs --env production
```

Or use `./scripts/deploy-production.sh`, which sources `deploy.env` before all client builds.

---

## Step 6 — Deploy

```bash
cd /path/to/splitsecond-pos
export CLOUD_PROVIDER=azure
export AZURE_KEY_VAULT_URL=https://cafinity-dev-key.vault.azure.net/
export AZURE_KEY_VAULT_SECRET_NAME=innovapos-production-env

./scripts/deploy-production.sh
```

The script pulls `main`, `pnpm install`, builds SPAs, `pm2 reload`. Set `VITE_*` in `deploy.env` at repo root (see Step 5b).

---

## Step 7 — PM2

`ecosystem.config.cjs` injects `cloudEnv` into every process. With `CLOUD_PROVIDER=azure` (default when unset in file), PM2 passes Key Vault bootstrap vars.

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

---

## Switching AWS ↔ Azure (configuration only)

| Action | AWS EC2 | Azure VM |
|--------|---------|----------|
| Bootstrap | `CLOUD_PROVIDER=aws`, `AWS_SECRETS_MANAGER_SECRET_ID=...` | `CLOUD_PROVIDER=azure`, `AZURE_KEY_VAULT_URL=...` |
| Secret JSON | In Secrets Manager | In Key Vault |
| Storage keys | `STORAGE_PROVIDER=aws`, `AWS_S3_BUCKET=...` | `STORAGE_PROVIDER=azure`, `AZURE_STORAGE_ACCOUNT_NAME=...` |
| Identity | IAM instance role | VM managed identity |

Redeploy / `pm2 reload` after changing bootstrap or secret JSON. No application code edits.

---

## Ports (unchanged)

| Service | Port |
|---------|------|
| POS | 5000 |
| Admin | 5001 |
| Public web | 5002 |
| Auth | 3001 |
| Upload | 3002 |
| Audit | 3004 |
| QR order (guest SPA + API) | 5010 |

---

## Troubleshooting

### `Forbidden` / `keys/read` / `ForbiddenByRbac` on `cafinity-dev-key`

**What the error means**

| Field | Your error | What the app needs |
|--------|------------|-------------------|
| Action | `Microsoft.KeyVault/vaults/keys/read` | `Microsoft.KeyVault/vaults/secrets/get` |
| Caller | `appid=04b07795-8ddb-461a-bbee-02f9e1bf7b46` = **Azure CLI** (your login) | VM **managed identity** when Node starts |
| Assignment | `(not found)` | No RBAC role on this vault yet |

So this is usually **you** (Portal or `az` CLI), not the POS app, trying to use **Keys** or listing the vault without a role. The app only reads a **Secret** named e.g. `innovapos-production-env`.

**Fix — two identities**

1. **Your user** (create/edit secrets via CLI or Portal → **Secrets**, not Keys):

```bash
VAULT_ID="/subscriptions/69a02a12-7297-410c-a6de-2d3c9aba54be/resourceGroups/cafinity-group/providers/Microsoft.KeyVault/vaults/cafinity-dev-key"

# Replace with your signed-in user object id from: az ad signed-in-user show --query id -o tsv
USER_OID="aa385f70-7cb0-48ba-8ba6-59f8e8e11c23"

az role assignment create \
  --role "Key Vault Secrets Officer" \
  --assignee-object-id "$USER_OID" \
  --assignee-principal-type User \
  --scope "$VAULT_ID"
```

2. **Azure VM** (runtime — read secret only):

```bash
# VM → Identity → System assigned → copy Object (principal) ID
VM_OID="<vm-managed-identity-object-id>"

az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee-object-id "$VM_OID" \
  --assignee-principal-type ServicePrincipal \
  --scope "$VAULT_ID"
```

Wait **5–10 minutes** after role assignment, then:

```bash
# Create/update the app config secret (not a Key)
az keyvault secret set \
  --vault-name cafinity-dev-key \
  --name innovapos-production-env \
  --file secrets.production.json
```

**Bootstrap on the VM** (must match vault name):

```bash
AZURE_KEY_VAULT_URL=https://cafinity-dev-key.vault.azure.net/
AZURE_KEY_VAULT_SECRET_NAME=innovapos-production-env
```

**Portal:** open **Secrets** → **Generate/Import**. Do not use **Keys** unless you manage certificates.

**Verify CLI can read the secret:**

```bash
az keyvault secret show --vault-name cafinity-dev-key --name innovapos-production-env --query value -o tsv | head -c 80
```

---

| Symptom | Check |
|---------|--------|
| `MongoDB connection string missing` but secret has `MONGO_URI` | Key Vault never loaded: add `bootstrap.env`, VM has **Key Vault Secrets User**, run `pnpm install && pnpm run verify:secrets`, then `pm2 reload ecosystem.config.cjs --env production` |
| `Cannot find module '@innovapos/runtime-env'` | Run `pnpm install` at monorepo root; use `pnpm run verify:secrets` |
| `Failed to load secrets` | VM identity has **Key Vault Secrets User**; vault URL and secret name match bootstrap |
| Upload 500 / storage error | `AZURE_STORAGE_ACCOUNT_NAME` in vault JSON; **Storage Blob Data Contributor** on VM |
| Images 403 / no presign URL | **Storage Blob Delegator** on VM |
| `timeout of 30000ms exceeded` on image upload | Usually **connectivity**, not file size. Run `pnpm run verify:upload` on the VM. Check: (1) `pm2 list` shows `upload-service` online, (2) `curl -s http://127.0.0.1:3002/health/storage`, (3) Key Vault has `STORAGE_PROVIDER=azure`, `AZURE_STORAGE_ACCOUNT_NAME`, `UPLOAD_SERVICE_URL=http://127.0.0.1:3002` (not public IP), (4) remove stale `AWS_S3_BUCKET` if migrated, (5) VM identity has **Storage Blob Data Contributor** + **Storage Blob Delegator**. Old `DefaultAzureCredential` probing CLI caused ~30s hangs — pull latest code. |
| `DefaultAzureCredential` failed | System-assigned identity enabled; not running outside Azure without service principal |
| Old AWS env still used | Remove `AWS_SECRETS_MANAGER_SECRET_ID` from bootstrap; set `CLOUD_PROVIDER=azure` |

---

## Related docs

- `docs/ENV_VARIABLES.md` — full environment variable reference (also `docs/ENV_VARIABLES.docx`)
- `secrets.example.json` — template for Key Vault JSON
- `docs/EC2_PRODUCTION_DEPLOY.md` — AWS EC2 path (legacy)
- `ecosystem.config.cjs` — PM2 bootstrap env

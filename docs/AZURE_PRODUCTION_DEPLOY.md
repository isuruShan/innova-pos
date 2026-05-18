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
AZURE_KEY_VAULT_URL=https://kv-innovapos-prod.vault.azure.net/
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
  --vault-name kv-innovapos-prod \
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

Same as EC2: Node 20+, pnpm, PM2, git clone.

```bash
sudo apt update && sudo apt install -y git
# Node 20 + pnpm + pm2 (see EC2_PRODUCTION_DEPLOY.md Step 4)
```

Bootstrap file on the VM (e.g. `/etc/innovapos/bootstrap.env`):

```bash
CLOUD_PROVIDER=azure
AZURE_KEY_VAULT_URL=https://kv-innovapos-prod.vault.azure.net/
AZURE_KEY_VAULT_SECRET_NAME=innovapos-production-env
```

Load before PM2:

```bash
set -a && source /etc/innovapos/bootstrap.env && set +a
```

---

## Step 6 — Deploy

```bash
cd /path/to/splitsecond-pos
export CLOUD_PROVIDER=azure
export AZURE_KEY_VAULT_URL=https://kv-innovapos-prod.vault.azure.net/
export AZURE_KEY_VAULT_SECRET_NAME=innovapos-production-env

./scripts/deploy-production.sh
```

The script pulls `main`, `pnpm install`, builds SPAs, `pm2 reload`. Set `VITE_*` in `deploy.env` at repo root for build-time client URLs.

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
| QR order | (see ecosystem.config.cjs) |

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `Failed to load secrets` | VM identity has **Key Vault Secrets User**; vault URL and secret name match bootstrap |
| Upload 500 / storage error | `AZURE_STORAGE_ACCOUNT_NAME` in vault JSON; **Storage Blob Data Contributor** on VM |
| Images 403 / no presign URL | **Storage Blob Delegator** on VM |
| `DefaultAzureCredential` failed | System-assigned identity enabled; not running outside Azure without service principal |
| Old AWS env still used | Remove `AWS_SECRETS_MANAGER_SECRET_ID` from bootstrap; set `CLOUD_PROVIDER=azure` |

---

## Related docs

- `secrets.example.json` — template for Key Vault JSON
- `docs/EC2_PRODUCTION_DEPLOY.md` — AWS EC2 path (legacy)
- `ecosystem.config.cjs` — PM2 bootstrap env

# InnovaSolutions POS — Environment Variables Reference

Complete list of environment variables for all applications in the monorepo.

**Last updated:** 2026-05-19

---

## Where variables are set


| Layer                  | File / location                                             | Purpose                                                                          |
| ---------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Host bootstrap**     | `bootstrap.env` or `/etc/innovapos/bootstrap.env`           | Key Vault / AWS secret pointer only (not `MONGO_URI`)                            |
| **Production secrets** | Azure Key Vault or AWS Secrets Manager JSON                 | One JSON blob merged into every Node process at startup (`secrets.example.json`) |
| **Build-time (Vite)**  | `deploy.env` at repo root (or per-client `.env.production`) | `VITE_`* — baked into browser bundles at `pnpm run build`                        |
| **Local dev**          | Each app’s `.env.example` → copy to `.env`                  | Per-service overrides                                                            |


### PM2 processes (`ecosystem.config.cjs`)


| PM2 name            | Application                                           |
| ------------------- | ----------------------------------------------------- |
| `pos-server`        | POS API + serves `apps/pos/client/dist` in production |
| `admin-server`      | Admin portal API + static client                      |
| `public-web-server` | Marketing / signup API + static client                |
| `qr-order-server`   | Guest table-order API + static client                 |
| `auth-service`      | Shared auth API                                       |
| `upload-service`    | Image / document uploads (Azure Blob or AWS S3)       |


**Not in PM2** (run manually if needed): `audit-service`

---

## Platform-wide (all / most Node services)


| Variable                            | Used by                                               | Notes                                            |
| ----------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| `NODE_ENV`                          | All servers                                           | `development` | `production`                     |
| `PORT`                              | Each server                                           | See ports table below                            |
| `SERVICE_NAME`                      | Logging / audit                                       | e.g. `pos-server`, `upload-service`              |
| **Secrets loading**                 |                                                       |                                                  |
| `SECRETS_PROVIDER`                  | All servers using `runtime-env`                       | `azure` | `aws` | `none`                         |
| `CLOUD_PROVIDER`                    | PM2 bootstrap                                         | Alias for provider choice                        |
| `SECRETS_MERGE_MODE`                | `runtime-env`                                         | `fill` (default) | `override`                    |
| `AWS_SECRETS_MERGE_MODE`            | Legacy alias                                          | Same as `SECRETS_MERGE_MODE`                     |
| **Azure Key Vault**                 |                                                       |                                                  |
| `AZURE_KEY_VAULT_URL`               | Bootstrap + runtime                                   | e.g. `https://your-vault.vault.azure.net/`       |
| `AZURE_KEY_VAULT_SECRET_NAME`       | Bootstrap + runtime                                   | e.g. `innovapos-production-env`                  |
| **AWS Secrets Manager**             |                                                       |                                                  |
| `AWS_SECRETS_MANAGER_SECRET_ID`     | AWS path                                              | Secret id                                        |
| `AWS_SECRETS_MANAGER_ARN`           | AWS path                                              | Alternate                                        |
| `AWS_SECRET_ID`                     | AWS path                                              | Alternate                                        |
| `AWS_REGION`                        | AWS SDK                                               | Default `us-east-1`                              |
| `AWS_DEFAULT_REGION`                | AWS SDK                                               | Fallback                                         |
| **Database**                        | All DB-backed services                                |                                                  |
| `MONGO_URI`                         | POS, admin, auth, public-web, qr-order, audit, upload | Primary connection string                        |
| `MONGODB_URI`                       | Same                                                  | Alternate name                                   |
| `MONGODB_ATLAS_URI`                 | Same                                                  | Alternate name (Atlas)                           |
| **Auth**                            |                                                       |                                                  |
| `JWT_SECRET`                        | All authenticated APIs                                | Must match across all services                   |
| `JWT_EXPIRES_IN`                    | POS, auth                                             | Default `12h`                                    |
| `INTERNAL_SERVICE_KEY`              | upload, public-web, audit                             | Server-to-server uploads / audit                 |
| **CORS**                            |                                                       |                                                  |
| `CORS_ORIGIN`                       | Most servers                                          | Comma-separated allowed origins                  |
| **Inter-service URLs**              |                                                       |                                                  |
| `UPLOAD_SERVICE_URL`                | POS, admin, public-web                                | Default `http://localhost:3002`                  |
| `AUDIT_SERVICE_URL`                 | Services using audit emit                             | Default `http://localhost:3004`                  |
| **Object storage**                  | upload-service                                        |                                                  |
| `STORAGE_PROVIDER`                  | upload                                                | `azure` | `aws`                                  |
| `AZURE_STORAGE_ACCOUNT_NAME`        | Azure blob                                            | Required for Azure                               |
| `AZURE_STORAGE_CONTAINER_NAME`      | Azure blob                                            | Default `uploads`                                |
| `AZURE_STORAGE_CONTAINER`           | Azure blob                                            | Alias for container name                         |
| `AZURE_DELEGATION_KEY_HOURS`        | Azure SAS cache                                       | Default `1`                                      |
| `AWS_S3_BUCKET`                     | AWS S3                                                | Required for AWS                                 |
| `AWS_PROFILE`                       | Local AWS dev                                         | Optional named profile                           |
| `AWS_ACCESS_KEY_ID`                 | AWS                                                   | Usually unset on VM (use IAM / managed identity) |
| `AWS_SECRET_ACCESS_KEY`             | AWS                                                   | Usually unset on VM                              |
| **Upload limits / processing**      | upload-service                                        |                                                  |
| `MAX_IMAGE_SIZE_MB`                 | upload                                                | Default `5`                                      |
| `MAX_DOC_SIZE_MB`                   | upload                                                | Default `10`                                     |
| `UPLOAD_MAX_IMAGE_DIMENSION`        | upload                                                | Default `2048`                                   |
| `WEBP_QUALITY`                      | upload                                                | Default `82`                                     |
| `UPLOAD_WEBP_EFFORT`                | upload                                                | Default `3` (Sharp WebP effort 0–6)              |
| `UPLOAD_PROXY_TIMEOUT_MS`           | POS, admin, public-web upload proxies                 | Default `120000` (ms)                            |
| **Email**                           | auth, POS, admin, public-web                          |                                                  |
| `EMAIL_FROM`                        | Mailers                                               | Sender address                                   |
| `EMAIL_APP_PASSWORD`                | Gmail                                                 | App password                                     |
| `SMTP_HOST`                         | Optional SMTP                                         |                                                  |
| `SMTP_PORT`                         | Optional SMTP                                         | Default `587`                                    |
| `SMTP_SECURE`                       | Optional SMTP                                         | `true` / `false`                                 |
| `SMTP_USER`                         | Optional SMTP                                         |                                                  |
| `SMTP_PASS`                         | Optional SMTP                                         |                                                  |
| **Public URLs (emails, redirects)** |                                                       |                                                  |
| `POS_URL`                           | auth, admin, POS                                      | Staff POS link                                   |
| `ADMIN_URL`                         | auth, admin                                           | Admin UI link                                    |
| `ADMIN_PORTAL_URL`                  | admin, POS tenant settings                            | Admin API / portal base                          |
| `FRONTEND_URL`                      | auth                                                  | Password-reset base URL                          |
| `ADMIN_NOTIFY_EMAIL`                | admin, public-web                                     | New application alerts                           |
| `CONTACT_EMAIL`                     | public-web                                            | Contact form recipient                           |
| **Redis (optional)**                | POS notifications                                     |                                                  |
| `REDIS_URL`                         | POS SSE pub/sub across PM2 workers                    |                                                  |
| `RATE_LIMIT_REDIS_URL`              | POS (fallback)                                        | Used if `REDIS_URL` unset                        |
| **Logging**                         | All using `@innovapos/logger`                         |                                                  |
| `LOG_DIR`                           | Logger                                                | Default `./logs`                                 |
| `LOG_SERVICE_ID`                    | Logger                                                | Override service folder name                     |
| `LOG_LEVEL`                         | Logger                                                | `info`, `debug`, etc.                            |
| **PM2 / host**                      |                                                       |                                                  |
| `PM2_INSTANCES`                     | ecosystem                                             | POS cluster workers (default `2`)                |
| `INNOVA_BOOTSTRAP_ENV`              | ecosystem                                             | Custom path to `bootstrap.env`                   |


---

## Default ports


| Application              | `PORT` | PM2 name                    |
| ------------------------ | ------ | --------------------------- |
| Auth service             | `3001` | `auth-service`              |
| Upload service           | `3002` | `upload-service`            |
| Audit service            | `3004` | (manual / not in ecosystem) |
| POS API                  | `5000` | `pos-server`                |
| Admin API                | `5001` | `admin-server`              |
| Public web API           | `5002` | `public-web-server`         |
| QR order API + guest SPA | `5010` | `qr-order-server`           |


**Vite dev ports** (local only, not server env): POS client `5173`, Admin client `5174`, QR order client `5180`.

---

## 1. POS server (`apps/pos/server`)


| Variable                             | Required           | Notes                           |
| ------------------------------------ | ------------------ | ------------------------------- |
| Platform vars (above)                | Yes in production  | Via Key Vault / Secrets Manager |
| `PORT`                               | No                 | Default `5000`                  |
| `SERVICE_NAME`                       | No                 | `pos-server`                    |
| `MONGO_URI`                          | Yes                |                                 |
| `JWT_SECRET`, `JWT_EXPIRES_IN`       | Yes                |                                 |
| `UPLOAD_SERVICE_URL`                 | Recommended        |                                 |
| `AUDIT_SERVICE_URL`                  | Recommended        |                                 |
| `CORS_ORIGIN`                        | Production         | Comma-separated                 |
| `REDIS_URL` / `RATE_LIMIT_REDIS_URL` | Optional           | Multi-worker notification SSE   |
| `EMAIL_`*, `SMTP_*`                  | If sending mail    |                                 |
| `POS_URL`, `ADMIN_PORTAL_URL`        | Email / deep links |                                 |


**Example:** `apps/pos/server/.env.example`

---

## 2. POS client (`apps/pos/client`) — build time only


| Variable                        | Notes                                                              |
| ------------------------------- | ------------------------------------------------------------------ |
| `VITE_API_URL`                  | POS API base, e.g. `https://pos.example.com/api`                   |
| `VITE_ADMIN_URL`                | Admin portal link in navbar                                        |
| `VITE_ADMIN_PORTAL_URL`         | Subscription-blocked page link                                     |
| `VITE_QR_ORDER_WEB_ORIGIN`      | Guest order app for Café table QR codes (port `5010`, not POS URL) |
| `VITE_PUBLIC_ORDER_PAGE_ORIGIN` | Legacy fallback for QR origin                                      |


Set in `deploy.env` or `apps/pos/client/.env.production` before `pnpm --filter @pos/client run build`.

**Example:** `apps/pos/client/.env.example`

---

## 3. Admin portal server (`apps/admin-portal/server`)


| Variable                                   | Required      | Notes                          |
| ------------------------------------------ | ------------- | ------------------------------ |
| Platform + DB + JWT                        | Yes           |                                |
| `PORT`                                     | No            | Default `5001`                 |
| `SERVICE_NAME`                             | No            | `admin-portal-server`          |
| `UPLOAD_SERVICE_URL`, `AUDIT_SERVICE_URL`  | Recommended   |                                |
| `POS_URL`, `ADMIN_URL`, `ADMIN_PORTAL_URL` | Email / links |                                |
| `EMAIL_`*, `SMTP_*`                        | Mail          |                                |
| `STRIPE_SECRET_KEY`                        | Optional      | Or stored in DB payment config |
| `STRIPE_WEBHOOK_SECRET`                    | Optional      |                                |
| `PAYPAL_CLIENT_ID`                         | Optional      |                                |
| `PAYPAL_CLIENT_SECRET`                     | Optional      |                                |
| `CORS_ORIGIN`                              | Production    |                                |


**Example:** `apps/admin-portal/server/.env.example`

---

## 4. Admin portal client (`apps/admin-portal/client`) — build time only


| Variable                    | Notes                                                  |
| --------------------------- | ------------------------------------------------------ |
| `VITE_API_URL`              | Admin API, e.g. `https://admin.example.com/api`        |
| `VITE_POS_URL`              | “Open POS” sidebar link                                |
| `VITE_HIDE_PAYMENT_SECRETS` | `true` hides secret fields in superadmin payment setup |


**Example:** `apps/admin-portal/client/.env.example`

---

## 5. Public web server (`apps/public-web/server`)


| Variable                              | Required           | Notes                       |
| ------------------------------------- | ------------------ | --------------------------- |
| `MONGO_URI`, `JWT_SECRET`             | Yes                |                             |
| `PORT`                                | No                 | Default `5002`              |
| `UPLOAD_SERVICE_URL`                  | Yes for BR uploads |                             |
| `INTERNAL_SERVICE_KEY`                | **Yes**            | Must match `upload-service` |
| `EMAIL_`*, `SMTP_*`                   | Mail               |                             |
| `ADMIN_NOTIFY_EMAIL`, `CONTACT_EMAIL` | Notifications      |                             |
| `CORS_ORIGIN`                         | Production         |                             |


**Example:** `apps/public-web/server/.env.example`

---

## 6. Public web client (`apps/public-web/client`) — build time only


| Variable                  | Notes                                         |
| ------------------------- | --------------------------------------------- |
| `VITE_PUBLIC_WEB_API_URL` | API base; dev default `http://localhost:5002` |


**Example:** `apps/public-web/client/.env.example`

---

## 7. QR order server (`apps/qr-order/server`)


| Variable             | Required   | Notes                                |
| -------------------- | ---------- | ------------------------------------ |
| `MONGO_URI`          | Yes        | Same database as POS                 |
| `PORT`               | No         | Default `5010`                       |
| `CORS_ORIGIN`        | Production | Guest SPA origin(s), comma-separated |
| Cloud bootstrap vars | Production | Key Vault / Secrets Manager          |


**Example:** `apps/qr-order/server/.env.example`

---

## 8. QR order client (`apps/qr-order/client`) — build time only


| Variable                | Notes                                       |
| ----------------------- | ------------------------------------------- |
| `VITE_QR_ORDER_API_URL` | API base for guest SPA in production builds |
| `VITE_DEV_QR_ORDER_API` | Vite dev proxy target only                  |


**Example:** `apps/qr-order/client/.env.example`

---

## 9. Auth service (`services/auth-service`)


| Variable                               | Required         | Notes |
| -------------------------------------- | ---------------- | ----- |
| `MONGO_URI`                            | Yes              |       |
| `JWT_SECRET`, `JWT_EXPIRES_IN`         | Yes              |       |
| `AUDIT_SERVICE_URL`                    | Optional         |       |
| `EMAIL_`*, `SMTP_*`                    | Mail             |       |
| `POS_URL`, `ADMIN_URL`, `FRONTEND_URL` | Email links      |       |
| `CORS_ORIGIN`                          | Production       |       |
| `SUPERADMIN_EMAIL`                     | Seed script only |       |
| `SUPERADMIN_PASSWORD`                  | Seed script only |       |
| `SUPERADMIN_NAME`                      | Seed script only |       |


**Example:** `services/auth-service/.env.example`

---

## 10. Upload service (`services/upload-service`)


| Variable                                                           | Required                          | Notes                  |
| ------------------------------------------------------------------ | --------------------------------- | ---------------------- |
| `JWT_SECRET`                                                       | Yes                               | Validates upload JWT   |
| `INTERNAL_SERVICE_KEY`                                             | **Yes** for public-web BR uploads | Shared with public-web |
| `STORAGE_PROVIDER` + Azure or AWS vars                             | Yes                               |                        |
| `MAX_IMAGE_SIZE_MB`, `MAX_DOC_SIZE_MB`                             | No                                | Defaults `5` / `10`    |
| `UPLOAD_MAX_IMAGE_DIMENSION`, `WEBP_QUALITY`, `UPLOAD_WEBP_EFFORT` | No                                | Image processing       |
| `AUDIT_SERVICE_URL`, `CORS_ORIGIN`                                 | Optional                          |                        |


**Example:** `services/upload-service/.env.example`

---

## 11. Audit service (`services/audit-service`)


| Variable               | Required | Notes           |
| ---------------------- | -------- | --------------- |
| `MONGO_URI`            | Yes      |                 |
| `JWT_SECRET`           | Yes      |                 |
| `INTERNAL_SERVICE_KEY` | Optional | Internal ingest |
| `PORT`                 | No       | Default `3004`  |


**Example:** `services/audit-service/.env.example`

---

## Production secret JSON (`secrets.example.json`)

Keys intended for **Azure Key Vault** or **AWS Secrets Manager** (merged at runtime for PM2 processes):

```
NODE_ENV
SECRETS_PROVIDER
STORAGE_PROVIDER
MONGO_URI
JWT_SECRET
JWT_EXPIRES_IN
INTERNAL_SERVICE_KEY
REDIS_URL
RATE_LIMIT_REDIS_URL
CORS_ORIGIN
UPLOAD_SERVICE_URL
AUDIT_SERVICE_URL
POS_URL
ADMIN_URL
ADMIN_PORTAL_URL
FRONTEND_URL
EMAIL_FROM
EMAIL_APP_PASSWORD
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
ADMIN_NOTIFY_EMAIL
CONTACT_EMAIL
AZURE_STORAGE_ACCOUNT_NAME
AZURE_STORAGE_CONTAINER_NAME
MAX_IMAGE_SIZE_MB
MAX_DOC_SIZE_MB
UPLOAD_MAX_IMAGE_DIMENSION
WEBP_QUALITY
LOG_DIR
LOG_SERVICE_ID
LOG_LEVEL
PM2_INSTANCES
VITE_API_URL
VITE_PUBLIC_WEB_API_URL
VITE_POS_API_URL
VITE_PUBLIC_ORDER_PAGE_ORIGIN
VITE_QR_ORDER_WEB_ORIGIN
VITE_QR_ORDER_API_URL
VITE_ADMIN_URL
VITE_POS_URL
```

**Also add for AWS:** `AWS_S3_BUCKET`, `AWS_REGION`, and payment keys if not only in MongoDB.

**Note:** `VITE_`* in Key Vault do **not** update already-built browser bundles. Set them in `deploy.env` when running `scripts/deploy-production.sh` or manual `pnpm run build`.

---

## Host bootstrap (`bootstrap.env.example`)

```
CLOUD_PROVIDER=azure
SECRETS_PROVIDER=azure
STORAGE_PROVIDER=azure
AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/
AZURE_KEY_VAULT_SECRET_NAME=innovapos-production-env
# Optional: SECRETS_MERGE_MODE=override
```

For AWS instead:

```
CLOUD_PROVIDER=aws
SECRETS_PROVIDER=aws
STORAGE_PROVIDER=aws
AWS_SECRETS_MANAGER_SECRET_ID=your-secret-id
AWS_REGION=us-east-1
```

---

## Build deploy file (`deploy.env.example`)

Loaded by `scripts/deploy-production.sh` before Vite builds:

```
VITE_API_URL=http://YOUR_HOST:5000/api
VITE_ADMIN_URL=http://YOUR_HOST:5001
VITE_PUBLIC_WEB_API_URL=http://YOUR_HOST:5002
VITE_QR_ORDER_WEB_ORIGIN=http://YOUR_HOST:5010
```

---

## Minimal Azure VM checklist

1. `**bootstrap.env**` — vault URL + secret name (no `MONGO_URI`).
2. **Key Vault JSON** — `MONGO_URI`, `JWT_SECRET`, `INTERNAL_SERVICE_KEY`, `CORS_ORIGIN`, `UPLOAD_SERVICE_URL`, `STORAGE_PROVIDER=azure`, `AZURE_STORAGE_*`, public URLs, email settings.
3. `**deploy.env`** — all `VITE_*` URLs for your public IP or domain before client builds.
4. **PM2** — `pm2 start ecosystem.config.cjs --env production`.

---

## Related documentation

- `docs/AZURE_PRODUCTION_DEPLOY.md` — Azure VM deployment
- `docs/EC2_PRODUCTION_DEPLOY.md` — AWS EC2 deployment
- `secrets.example.json` — Key Vault / Secrets Manager template
- `bootstrap.env.example` — Host bootstrap template
- `deploy.env.example` — Vite build-time template
- `ecosystem.config.cjs` — PM2 process definitions


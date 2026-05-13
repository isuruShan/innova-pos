# Run Splitsecond POS on EC2 in production (with AWS Secrets Manager)

This guide assumes you deploy from this monorepo on an **Amazon Linux 2023** or **Ubuntu 22.04+** EC2 instance. File extension is `**.md` (Markdown)** — useful for humans; **MD5** is a checksum algorithm, not a doc format.

## What you are running


| Component               | Default port      | Role                                                                                  |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| POS API + static POS UI | `5000`            | `apps/pos/server` serves `apps/pos/client/dist` when `NODE_ENV=production`            |
| Admin portal API + UI   | `5001`            | `apps/admin-portal/server` + `client/dist`                                            |
| Public web API + site   | `5002`            | `apps/public-web/server` + `client/dist`                                              |
| Auth service            | `3001`            | `services/auth-service`                                                               |
| Upload service          | `3002`            | `services/upload-service` (S3)                                                        |
| Audit service           | `3004`            | `services/audit-service`                                                              |
| MongoDB                 | `27017` (typical) | Not part of this repo — use Atlas or EC2/RDS + security group rules                   |
| Redis (optional)        | `6379`            | Set `REDIS_URL` or `RATE_LIMIT_REDIS_URL` for **global** rate limits across processes |


Node servers load `**.env` first**, then merge **one JSON secret** from Secrets Manager if `AWS_SECRETS_MANAGER_SECRET_ID` (or `AWS_SECRETS_MANAGER_ARN` / `AWS_SECRET_ID`) is set. On EC2, **no access keys in files** are required if the instance profile can call `secretsmanager:GetSecretValue`.

---

## Step 1 — EC2 sizing and networking

1. Launch EC2 in a **VPC** with outbound internet (for `pnpm`/npm) unless you use a private mirror.
2. **Security groups**
  - Allow **SSH** (22) from your IP only (or SSM Session Manager and no SSH).
  - Allow **HTTP/HTTPS** (80/443) from the internet **only** if users hit the instance directly; prefer an **ALB** in front and keep app ports private.
  - Allow app ports **only from the load balancer** or internal CIDRs (e.g. `5000–5002`, `3001–3002`, `3004`).
3. Open **MongoDB** from this instance only (Atlas IP allowlist, or SG rule to Mongo port on a DB host).

---

## Step 2 — IAM instance role (Secrets Manager + S3 + optional KMS)

1. In **IAM** → **Roles** → **Create role** → **AWS service** → **EC2**.
2. Attach a **customer inline policy** (adjust ARNs and region).

**Minimum for one consolidated secret**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadConsolidatedAppSecret",
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:YOUR_SECRET_NAME-6RandomChars"
    },
    {
      "Sid": "S3Uploads",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    },
    {
      "Sid": "S3ListBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME"
    }
  ]
}
```

1. If the secret uses a **customer managed KMS key**, add `**kms:Decrypt`** on that key’s ARN.
2. Attach the role to your EC2 instance (**Actions** → **Security** → **Modify IAM role**).

---

## Step 3 — Create the secret in AWS Secrets Manager

1. **Secrets Manager** → **Store a new secret** → **Other type of secret** → **Plaintext**.
2. Paste a **single JSON object** with string values (see `secrets.example.json` in the repo root). Include at least:
  - `MONGO_URI` — paste your **full MongoDB Atlas connection string** here (it is a URI: `mongodb+srv://user:pass@cluster/...`). Same field works for local `mongodb://...`. Alternatives: `MONGODB_URI` or `MONGODB_ATLAS_URI` if you prefer the Atlas UI naming (first non-empty wins). URL-encode characters in the password if needed.
  - `JWT_SECRET`, `INTERNAL_SERVICE_KEY` (match across public-web + upload-service)
  - `UPLOAD_SERVICE_URL`, `AUDIT_SERVICE_URL`, URLs for emails (`POS_URL`, `ADMIN_URL`, `FRONTEND_URL`, `ADMIN_PORTAL_URL`, …)
  - `AWS_REGION`, `AWS_S3_BUCKET` (upload service)
  - Mail: `EMAIL_FROM`, `EMAIL_APP_PASSWORD` or `SMTP_`*
  - Optional: `REDIS_URL` or `RATE_LIMIT_REDIS_URL`, `CORS_ORIGIN` (comma-separated origins in production)
3. **Do not** put `AWS_SECRETS_MANAGER_SECRET_ID` inside the secret (chicken-and-egg). That value lives on the host as bootstrap env (next step).
4. Default merge is **fill**: Secrets Manager only sets keys that are **empty** after `.env`. To force the secret to overwrite `.env`, set host env `AWS_SECRETS_MERGE_MODE=override`.

---

## Step 4 — Install system dependencies on EC2

Run as root or with `sudo` where needed.

### Amazon Linux 2023 (example)

```bash
sudo dnf update -y
sudo dnf install -y git
```

### Node.js 20+ and pnpm

Use [NodeSource](https://github.com/nodesource/distributions) or `nvm`; ensure `**node -v` ≥ 20**.

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm -v
```

---

## Step 5 — Deploy the application code

```bash
sudo mkdir -p /opt/splitsecond-pos
sudo chown "$USER:$USER" /opt/splitsecond-pos
cd /opt/splitsecond-pos
git clone https://github.com/YOUR_ORG/splitsecond-pos.git .
# or rsync/scp your artifact; then:
pnpm install
```

---

## Step 6 — Bootstrap environment (on disk, not in the JSON secret)

Create a small file the process manager can load (example: `/opt/splitsecond-pos/.env.production` — **not** committed to git; chmod `600`).

```bash
NODE_ENV=production
AWS_REGION=us-east-1
AWS_SECRETS_MANAGER_SECRET_ID=arn:aws:secretsmanager:us-east-1:123456789012:secret:splitsecond/prod-AbCdEf
# Optional: AWS_SECRETS_MERGE_MODE=override
# Optional for Redis-backed rate limits:
# REDIS_URL=redis://your-elasticache-endpoint.cache.amazonaws.com:6379
```

**Per-process `PORT`** (if multiple Node apps on one instance): set in the same file **or** in separate systemd/PM2 unit env blocks, e.g. `PORT=5000` for POS, `PORT=5001` for admin, etc. If each service runs on its **own** instance, each host only needs one `PORT` or the default from code.

**Dotenv paths:** each app loads its own `apps/<app>/server/.env` first. Easiest on EC2: symlink or copy your bootstrap file to each server’s expected path, **or** export variables in systemd/PM2 (recommended) so you maintain one place.

---

## Step 7 — Build frontends (production)

Vite bakes `**VITE_*`** at **build** time. Set them **when you run `vite build`**, not only in Secrets Manager (the browser bundle does not read server env at runtime).

Example (replace with your public URLs):

```bash
export NODE_ENV=production

# POS client → talks to your POS API origin + /api
cd /opt/splitsecond-pos/apps/pos/client
VITE_API_URL=https://pos-api.example.com/api pnpm run build

cd /opt/splitsecond-pos/apps/admin-portal/client
# If admin API is same host as admin UI in your setup, adjust; often separate subdomain:
VITE_API_URL=https://admin-api.example.com/api pnpm run build

cd /opt/splitsecond-pos/apps/public-web/client
VITE_PUBLIC_WEB_API_URL=https://www.example.com pnpm run build
```

Rebuild clients whenever public URLs or API bases change.

### How this maps to “running” the clients on EC2

You **do not** run `pnpm dev`, `vite`, or `vite preview` on the production server for traffic. Those are **development** servers.

In production:

1. `**pnpm run build`** (above) writes static files to each app’s `**client/dist/**` folder.
2. You start only the matching **Node server** with `**NODE_ENV=production`** (Step 8).
3. That server serves `**dist**` as static files and `**/{*path}**` falls through to `**index.html**` for the React SPA (POS and admin portal already do this when `dist` exists; public web server does the same).

So each **browser-facing site** is one process:


| Site                 | Build folder                    | Process to run                   | Default port |
| -------------------- | ------------------------------- | -------------------------------- | ------------ |
| POS UI + POS API     | `apps/pos/client/dist`          | `apps/pos/server` (`pnpm start`) | `5000`       |
| Admin UI + admin API | `apps/admin-portal/client/dist` | `apps/admin-portal/server`       | `5001`       |
| Public site + API    | `apps/public-web/client/dist`   | `apps/public-web/server`         | `5002`       |


Users reach `**https://pos.example.com`** via **Nginx →** `http://127.0.0.1:5000` (etc.), not via a separate Vite port.

If `**dist`** is missing, the API still runs but **no SPA** is served — build the client **before** or **after** pulling code on EC2.

---

## Step 8 — Run Node servers in production

Each server entrypoint runs `loadAwsSecretsManagerEnv()` when `AWS_SECRETS_MANAGER_SECRET_ID` (or ARN alias) is set; the SDK uses the **instance role** automatically.

**Minimal manual test (foreground, one terminal each or use `&`):**

```bash
cd /opt/splitsecond-pos
set -a && source /opt/splitsecond-pos/.env.production && set +a

# Example: POS server (loads dotenv from cwd/package .env if present, then Secrets Manager)
cd apps/pos/server && NODE_ENV=production PORT=5000 pnpm start
```

Repeat for `apps/admin-portal/server`, `apps/public-web/server`, `services/auth-service`, `services/upload-service`, `services/audit-service` with the correct `PORT` and the same bootstrap + secret access.

**Recommended:** use **systemd** (one unit per service) or **PM2** with one config listing all apps, `cwd` per app, `env_file` or `environment` for `NODE_ENV`, `AWS_REGION`, `AWS_SECRETS_MANAGER_SECRET_ID`, and `PORT`.

---

## Elastic IP only — no domain names and no Nginx

You can run everything **without** a DNS name and **without** Nginx by using a public **Elastic IP** and opening **Node’s ports** in the security group.

### Important: port in the URL

Nothing listens on **port 80** until you add Nginx (or another proxy). So `**http://YOUR_IP` alone will not load the app.** You must include the port:


| App            | Browser URL                |
| -------------- | -------------------------- |
| POS (UI + API) | `http://<ELASTIC_IP>:5000` |
| Admin portal   | `http://<ELASTIC_IP>:5001` |
| Public web     | `http://<ELASTIC_IP>:5002` |


### AWS setup

1. **Elastic IP** (optional but recommended): **EC2 → Elastic IPs → Allocate → Associate** with your instance. That keeps the same address across stop/start (an ordinary public IP can change).
2. **Security group → Inbound rules**: allow **TCP** on **5000**, **5001**, **5002** (and **3001–3004** only if you expose those services publicly — often you keep upload/auth/audit on `127.0.0.1` only). Source can be **My IP** for testing or **0.0.0.0/0** if you accept the risk while staging.

### Build the frontends for your IP

`VITE_*` values are baked at **build** time. Use `**http://`** and the **same IP and ports** users will type in the browser (example `EIP=3.210.65.252`):

```bash
export EIP=3.210.65.252

cd apps/pos/client
VITE_API_URL=http://${EIP}:5000/api pnpm run build

cd ../../admin-portal/client
VITE_API_URL=http://${EIP}:5001/api pnpm run build

cd ../../public-web/client
VITE_PUBLIC_WEB_API_URL=http://${EIP}:5002 pnpm run build
```

Rebuild if the Elastic IP or ports change.

### Server env / Secrets Manager (production `CORS` and links)

`CORS_ORIGIN` must list **exact** origins (scheme + IP + port), comma-separated:

```text
CORS_ORIGIN=http://3.210.65.252:5000,http://3.210.65.252:5001,http://3.210.65.252:5002
```

Also set URL fields used in emails / redirects to match, e.g.:

- `POS_URL=http://<EIP>:5000`
- `ADMIN_URL=http://<EIP>:5001`
- `FRONTEND_URL`, `ADMIN_PORTAL_URL` as appropriate.

Backend-to-backend URLs on the **same** EC2 instance can stay on loopback, e.g. `UPLOAD_SERVICE_URL=http://127.0.0.1:3002`, `AUDIT_SERVICE_URL=http://127.0.0.1:3004`.

### Caveats

- Traffic is **plain HTTP** — acceptable for testing; use **HTTPS + a domain** when you go live.
- Browsers treat `**http://` plus a public IP** as an **untrustworthy** origin. Helmet’s `**Cross-Origin-Opener-Policy`** header is ignored there and can log a console warning — the app disables that header so the warning does not appear; **HTTPS** is still required for full “powerful features” guarantees.
- Bookmarks must include `**:5000`** / `**:5001**` / `**:5002**` until you add Nginx on 80/443.

### CORS and same-origin

The API servers allow `**CORS_ORIGIN**` entries **and** requests whose `**Origin`** matches this server’s `**Host**` (same IP/port). That way the SPA loading `**/assets/***` from the same origin as the HTML is not blocked when `CORS_ORIGIN` omits the raw IP. Cross-origin calls (e.g. POS UI on `:5000` calling auth on `:3001`) still require both origins listed in `**CORS_ORIGIN**` on the target service.

---

## Step 9 — Reverse proxy (recommended)

Put **Nginx** or an **Application Load Balancer** in front:

- TLS termination at ALB/Nginx.
- Proxy `/` to the appropriate Node port (or hostnames per app).
- Set `**CORS_ORIGIN`** in the secret (or env) to your real browser origins (comma-separated).

**Full Nginx examples** (subdomains per service, TLS, snippets): see `**docs/NGINX_REVERSE_PROXY.md`**.

---

## Step 10 — Verify

1. **Health**
  - `curl -s http://127.0.0.1:5000/api/health` (POS)
  - `curl -s http://127.0.0.1:5001/api/health` (admin)
  - `curl -s http://127.0.0.1:5002/health` (public web)
  - `curl -s http://127.0.0.1:3001/health` (auth)
  - Similar for upload/audit.
2. **Secrets:** temporarily increase logging or add a one-off script that calls `loadAwsSecretsManagerEnv()` and prints `{ loaded: true }` (do not log secret values).
3. **Uploads:** confirm instance role **S3** policy and `AWS_S3_BUCKET` in the merged env.
4. **MongoDB:** confirm `MONGO_URI` resolves from the secret and connections succeed.

---

## Application logs (file layout)

Node APIs use `@innovapos/logger` with **one subdirectory per service** under `LOG_DIR` (default: `./logs` relative to each process `cwd`):

```text
logs/
  pos-server/combined-YYYY-MM-DD.log
  pos-server/error-YYYY-MM-DD.log
  admin-portal-server/combined-YYYY-MM-DD.log
  admin-portal-server/error-YYYY-MM-DD.log
  public-web-server/...
  auth-service/...
  upload-service/...
  audit-service/...
```

- Set `**LOG_DIR**` (e.g. `/var/log/cafinity`) so every service writes under that root **plus** its service folder.
- Optional `**LOG_SERVICE_ID`**: override the folder name if deployment tooling forces it (defaults to the name passed to `createLogger`, e.g. `pos-server`).
- `**LOG_LEVEL**`: e.g. `info`, `debug`.
- **React/Vite “clients”** (POS UI, admin UI, public site) do not write Winston files; they run in the browser. Only the **backend** process that serves each app produces these logs (each backend already uses its own `createLogger(...)` name).

---

## Troubleshooting


| Symptom                                                                    | Likely cause                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AccessDeniedException` on startup                                         | Instance role missing `secretsmanager:GetSecretValue` or wrong secret ARN                                                                                                                                                                  |
| App starts but env vars missing                                            | Secret JSON keys don’t match code; or `fill` mode and values already set in `.env` — use `override` or clear conflicting `.env` keys                                                                                                       |
| `CORS` errors in browser                                                   | `CORS_ORIGIN` in production must include exact origins (scheme + host + port)                                                                                                                                                              |
| Same-origin `/assets/*` 500 with `CORS: origin http://IP:PORT not allowed` | Deploy latest code (`createCorsMiddleware`); stack line inside `cors` at ~57 means **old** `index.js`. Or set `**CORS_ORIGIN`** to include that full `http://IP:PORT` until you redeploy. Stuck on EC2? See `**docs/EC2_CORS_HOTFIX.md**`. |
| Rate limits inconsistent across instances                                  | Set `REDIS_URL` / `RATE_LIMIT_REDIS_URL` and install deps (`pnpm install`)                                                                                                                                                                 |
| Blank API in built SPA                                                     | Rebuild clients with correct `VITE_*` at build time                                                                                                                                                                                        |


---

## Security checklist

- Restrict security groups; prefer ALB + TLS.
- Rotate `JWT_SECRET` and `INTERNAL_SERVICE_KEY` via secret versions; redeploy/restart processes.
- Do not commit `.env.production` or real secret JSON; use IAM + Secrets Manager only on EC2.

---

## Reference: env vars that must exist **outside** the JSON secret (bootstrap)

These tell the SDK **which** secret to load; keep them on the host or in the process manager:

- `AWS_REGION` (or `AWS_DEFAULT_REGION`)
- `AWS_SECRETS_MANAGER_SECRET_ID` **or** `AWS_SECRETS_MANAGER_ARN` **or** `AWS_SECRET_ID`

Everything else can live in the **single JSON secret** merged at runtime (see `secrets.example.json`).
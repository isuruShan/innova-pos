#!/usr/bin/env bash
# Production deploy: pull, install, build SPAs, reload PM2.
# Works on Azure VM or EC2 — set CLOUD_PROVIDER / Key Vault or Secrets Manager bootstrap before running.
# Requires /etc/innovapos/bootstrap.env or bootstrap.env in repo root for cloud provider config.
# Run from repo root: ./scripts/deploy-production.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Deploy from $ROOT"

if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Install Node 20+ and run: corepack prepare pnpm@9.15.0 --activate" >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found. Run: npm install -g pm2" >&2
  exit 1
fi

# Optional: export VITE_* / build-time vars (apps/*/client/.env.production)
if [[ -f "$ROOT/deploy.env" ]]; then
  echo "==> Loading $ROOT/deploy.env"
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/deploy.env"
  set +a
fi
echo "==> git stash"
git stash

echo "==> git pull"
git pull --ff-only origin main

echo "==> Copy .env.example to .env for client apps"
cp "$ROOT/apps/pos/client/.env.example" "$ROOT/apps/pos/client/.env"
cp "$ROOT/apps/admin-portal/client/.env.example" "$ROOT/apps/admin-portal/client/.env"
cp "$ROOT/apps/public-web/client/.env.example" "$ROOT/apps/public-web/client/.env"
cp "$ROOT/apps/qr-order/client/.env.example" "$ROOT/apps/qr-order/client/.env"
echo "    ✓ Client environment files created"

echo "==> pnpm install"
pnpm install 

echo "==> Build client bundles"
pnpm --filter @pos/client run build
pnpm --filter @admin-portal/client run build
pnpm --filter @public-web/client run build
pnpm --filter @qr-order/client run build

mkdir -p "$ROOT/logs"

echo "==> PM2 reload"
if pm2 describe pos-server >/dev/null 2>&1; then
  pm2 reload "$ROOT/ecosystem.config.cjs" --env production
else
  pm2 start "$ROOT/ecosystem.config.cjs" --env production
fi
pm2 save

echo "==> Done"
pm2 list

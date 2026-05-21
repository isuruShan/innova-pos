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

# Load VITE_* frontend URLs from Azure Key Vault or deploy.env
echo "==> Loading frontend URLs for build"
if [[ -f "$ROOT/deploy.env" ]]; then
  echo "    Loading VITE_* variables from deploy.env"
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/deploy.env"
  set +a
elif [[ -n "${AZURE_KEY_VAULT_URL:-}" ]]; then
  echo "    Fetching VITE_* variables from Azure Key Vault"
  # Use Node.js to fetch secrets and export them
  if command -v node >/dev/null 2>&1; then
    VAULT_VARS=$(node "$ROOT/scripts/fetch-frontend-urls.js")
    if [[ $? -eq 0 && -n "$VAULT_VARS" ]]; then
      set -a
      eval "$VAULT_VARS"
      set +a
      echo "    ✓ Frontend URLs loaded from Key Vault"
    else
      echo "    WARNING: Could not fetch URLs from Key Vault, using defaults"
    fi
  fi
fi

# Verify required VITE_* variables are set
REQUIRED_VITE_VARS=("VITE_POS_URL" "VITE_ADMIN_URL" "VITE_PUBLIC_WEB_URL" "VITE_QR_ORDER_WEB_ORIGIN")
MISSING_VARS=()
for var in "${REQUIRED_VITE_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    MISSING_VARS+=("$var")
  fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
  echo "    ERROR: Required frontend URL variables not set: ${MISSING_VARS[*]}"
  echo "    Create $ROOT/deploy.env with production URLs or add to Azure Key Vault secret"
  exit 1
fi

echo "    ✓ Frontend URLs configured:"
echo "      VITE_POS_URL=$VITE_POS_URL"
echo "      VITE_ADMIN_URL=$VITE_ADMIN_URL"
echo "      VITE_PUBLIC_WEB_URL=$VITE_PUBLIC_WEB_URL"
echo "      VITE_QR_ORDER_WEB_ORIGIN=$VITE_QR_ORDER_WEB_ORIGIN"

echo "==> git stash"
git stash

echo "==> git pull"
git pull --ff-only origin main

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

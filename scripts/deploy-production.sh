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

# Load VITE_* frontend URLs from deploy.env and/or Azure Key Vault
echo "==> Loading frontend URLs for build"

# Try deploy.env first
if [[ -f "$ROOT/deploy.env" ]]; then
  echo "    Loading variables from deploy.env"
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/deploy.env"
  set +a
fi

# If required VITE_* vars still missing, try Azure Key Vault
REQUIRED_VITE_VARS=("VITE_POS_URL" "VITE_ADMIN_URL" "VITE_PUBLIC_WEB_URL" "VITE_QR_ORDER_WEB_ORIGIN")
MISSING_VARS=()
for var in "${REQUIRED_VITE_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    MISSING_VARS+=("$var")
  fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 && -n "${AZURE_KEY_VAULT_URL:-}" ]]; then
  echo "    Some variables missing, fetching from Azure Key Vault..."
  if command -v node >/dev/null 2>&1; then
    VAULT_VARS=$(node "$ROOT/scripts/fetch-frontend-urls.js" 2>&1)
    if [[ $? -eq 0 && -n "$VAULT_VARS" ]]; then
      set -a
      eval "$VAULT_VARS"
      set +a
      echo "    ✓ Variables loaded from Key Vault"
      # Re-check if we got what we needed
      MISSING_VARS=()
      for var in "${REQUIRED_VITE_VARS[@]}"; do
        if [[ -z "${!var:-}" ]]; then
          MISSING_VARS+=("$var")
        fi
      done
    else
      echo "    WARNING: Could not fetch from Key Vault: $VAULT_VARS"
    fi
  fi
fi

# Final verification
if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
  echo "    ERROR: Required frontend URL variables not set: ${MISSING_VARS[*]}"
  echo ""
  echo "    Option 1: Create or update $ROOT/deploy.env with these variables:"
  for var in "${MISSING_VARS[@]}"; do
    echo "      $var=https://your-domain.com"
  done
  echo ""
  echo "    Option 2: Add these variables to your Azure Key Vault secret"
  echo "      Secret: \$AZURE_KEY_VAULT_SECRET_NAME"
  echo "      Vault: \$AZURE_KEY_VAULT_URL"
  echo ""
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

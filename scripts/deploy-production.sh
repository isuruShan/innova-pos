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

# Load bootstrap.env for Azure Key Vault configuration
BOOTSTRAP_LOADED=false
for bootstrap_path in "/etc/innovapos/bootstrap.env" "$ROOT/bootstrap.env"; do
  if [[ -f "$bootstrap_path" ]]; then
    echo "==> Loading bootstrap from $bootstrap_path"
    set -a
    # shellcheck source=/dev/null
    source "$bootstrap_path"
    set +a
    BOOTSTRAP_LOADED=true
    break
  fi
done

# Load VITE_* frontend URLs from Azure Key Vault or deploy.env
echo "==> Loading frontend URLs for build"

# If Azure Key Vault is configured, use it (preferred method)
if [[ -n "${AZURE_KEY_VAULT_URL:-}" && -n "${AZURE_KEY_VAULT_SECRET_NAME:-}" ]]; then
  echo "    Fetching VITE_* variables from Azure Key Vault..."
  
  if ! command -v az >/dev/null 2>&1; then
    echo "    WARNING: Azure CLI (az) not found, cannot fetch from Key Vault"
    echo "    Install Azure CLI: https://aka.ms/install-azure-cli"
    echo "    Falling back to deploy.env"
  elif ! command -v jq >/dev/null 2>&1; then
    echo "    WARNING: jq not found, cannot parse Key Vault secret"
    echo "    Install jq: sudo apt-get install jq"
    echo "    Falling back to deploy.env"
  else
    # Extract vault name from URL (e.g., https://mykeyvault.vault.azure.net/ -> mykeyvault)
    VAULT_NAME=$(echo "$AZURE_KEY_VAULT_URL" | sed -E 's|https://([^.]+)\.vault\.azure\.net/?|\1|')
    
    # Fetch secret from Azure Key Vault
    SECRET_JSON=$(az keyvault secret show --vault-name "$VAULT_NAME" --name "$AZURE_KEY_VAULT_SECRET_NAME" --query value -o tsv 2>&1)
    
    if [[ $? -eq 0 && -n "$SECRET_JSON" ]]; then
      # Extract VITE_* variables from the JSON secret
      VITE_VARS=("VITE_POS_URL" "VITE_ADMIN_URL" "VITE_PUBLIC_WEB_URL" "VITE_QR_ORDER_WEB_ORIGIN" "VITE_API_URL" "VITE_PUBLIC_WEB_API_URL" "VITE_QR_ORDER_API_URL")
      
      for var_name in "${VITE_VARS[@]}"; do
        var_value=$(echo "$SECRET_JSON" | jq -r ".$var_name // empty")
        if [[ -n "$var_value" ]]; then
          export "$var_name=$var_value"
        fi
      done
      
      echo "    ✓ Variables loaded from Key Vault (Vault: $VAULT_NAME, Secret: $AZURE_KEY_VAULT_SECRET_NAME)"
    else
      echo "    WARNING: Could not fetch secret from Key Vault"
      echo "    Error: $SECRET_JSON"
      echo "    Falling back to deploy.env if available"
    fi
  fi
fi

# Fall back to deploy.env if Key Vault didn't provide all variables
REQUIRED_VITE_VARS=("VITE_POS_URL" "VITE_ADMIN_URL" "VITE_PUBLIC_WEB_URL" "VITE_QR_ORDER_WEB_ORIGIN")
MISSING_VARS=()
for var in "${REQUIRED_VITE_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    MISSING_VARS+=("$var")
  fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 && -f "$ROOT/deploy.env" ]]; then
  echo "    Loading missing variables from deploy.env"
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/deploy.env"
  set +a
  # Re-check what's still missing
  MISSING_VARS=()
  for var in "${REQUIRED_VITE_VARS[@]}"; do
    if [[ -z "${!var:-}" ]]; then
      MISSING_VARS+=("$var")
    fi
  done
fi

# Final verification
if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
  echo "    ERROR: Required frontend URL variables not set: ${MISSING_VARS[*]}"
  echo ""
  if [[ -n "${AZURE_KEY_VAULT_URL:-}" ]]; then
    echo "    Please add these variables to your Azure Key Vault secret:"
    echo "      Secret: ${AZURE_KEY_VAULT_SECRET_NAME:-innovapos-production-env}"
    echo "      Vault: $AZURE_KEY_VAULT_URL"
    for var in "${MISSING_VARS[@]}"; do
      echo "        \"$var\": \"https://your-domain.com\""
    done
  else
    echo "    Option 1: Configure Azure Key Vault (recommended)"
    echo "      Set AZURE_KEY_VAULT_URL in bootstrap.env and add VITE_* to secret"
    echo ""
    echo "    Option 2: Create $ROOT/deploy.env with these variables:"
    for var in "${MISSING_VARS[@]}"; do
      echo "      $var=https://your-domain.com"
    done
  fi
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

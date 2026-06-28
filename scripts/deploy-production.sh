#!/usr/bin/env bash
# Production deploy: pull, install, build SPAs, reload PM2.
# Fetches frontend URLs (VITE_*) from Azure Key Vault for building client apps.
# Requires bootstrap.env with AZURE_KEY_VAULT_URL and AZURE_KEY_VAULT_SECRET_NAME.
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

# Load VITE_* frontend URLs from Azure Key Vault
echo "==> Loading frontend URLs for build"

# Azure Key Vault is required (no fallback)
if [[ -n "${AZURE_KEY_VAULT_URL:-}" && -n "${AZURE_KEY_VAULT_SECRET_NAME:-}" ]]; then
  echo "    Fetching VITE_* variables from Azure Key Vault..."
  
  if ! command -v az >/dev/null 2>&1; then
    echo "    ERROR: Azure CLI (az) not found"
    echo "    Install: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
    exit 1
  elif ! command -v jq >/dev/null 2>&1; then
    echo "    ERROR: jq not found"
    echo "    Install: sudo apt-get update && sudo apt-get install -y jq"
    exit 1
  else
    # Extract vault name from URL (e.g., https://mykeyvault.vault.azure.net/ -> mykeyvault)
    VAULT_NAME=$(echo "$AZURE_KEY_VAULT_URL" | sed -E 's|https://([^.]+)\.vault\.azure\.net/?|\1|')
    
    # Fetch secret from Azure Key Vault
    SECRET_JSON=$(az keyvault secret show --vault-name "$VAULT_NAME" --name "$AZURE_KEY_VAULT_SECRET_NAME" --query value -o tsv 2>&1)
    
    if [[ $? -eq 0 && -n "$SECRET_JSON" ]]; then
      # Extract VITE_* variables from the JSON secret
      VITE_VARS=("VITE_POS_URL" "VITE_ADMIN_URL" "VITE_PUBLIC_WEB_URL" "VITE_QR_ORDER_WEB_ORIGIN" "VITE_API_URL" "VITE_PUBLIC_WEB_API_URL" "VITE_QR_ORDER_API_URL" "VITE_CENTRAL_KITCHEN_URL" "VITE_CENTRAL_KITCHEN_API_URL")
      
      LOADED_COUNT=0
      for var_name in "${VITE_VARS[@]}"; do
        var_value=$(echo "$SECRET_JSON" | jq -r ".$var_name // empty")
        if [[ -n "$var_value" ]]; then
          export "$var_name=$var_value"
          LOADED_COUNT=$((LOADED_COUNT + 1))
        fi
      done
      
      echo "    ✓ Loaded $LOADED_COUNT VITE_* variables from Key Vault (Vault: $VAULT_NAME, Secret: $AZURE_KEY_VAULT_SECRET_NAME)"
    else
      echo ""
      echo "    ERROR: Could not fetch secret from Azure Key Vault"
      echo "    Error: $SECRET_JSON"
      echo ""
      echo "    Troubleshooting:"
      echo "      1. Ensure Azure CLI is authenticated: az login"
      echo "      2. Verify you have access to the Key Vault"
      echo "      3. Check that the secret exists: az keyvault secret list --vault-name $VAULT_NAME"
      echo ""
      exit 1
    fi
  fi
else
  echo ""
  echo "    ERROR: Azure Key Vault not configured"
  echo ""
  echo "    Configure bootstrap.env (or /etc/innovapos/bootstrap.env) with:"
  echo "      AZURE_KEY_VAULT_URL=https://your-keyvault.vault.azure.net/"
  echo "      AZURE_KEY_VAULT_SECRET_NAME=innovapos-production-env"
  echo ""
  exit 1
fi

# Verify all required VITE_* variables are set
REQUIRED_VITE_VARS=("VITE_POS_URL" "VITE_ADMIN_URL" "VITE_PUBLIC_WEB_URL" "VITE_QR_ORDER_WEB_ORIGIN")
MISSING_VARS=()
for var in "${REQUIRED_VITE_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    MISSING_VARS+=("$var")
  fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
  echo ""
  echo "    ERROR: Required frontend URL variables not set: ${MISSING_VARS[*]}"
  echo ""
  echo "    These variables are missing from your Azure Key Vault secret."
  echo "    Update your secret to include them:"
  echo ""
  echo "    Vault:  $AZURE_KEY_VAULT_URL"
  echo "    Secret: $AZURE_KEY_VAULT_SECRET_NAME"
  echo ""
  echo "    Missing variables to add (JSON format):"
  for var in "${MISSING_VARS[@]}"; do
    echo "      \"$var\": \"http://your-server-ip:port\""
  done
  echo ""
  echo "    Update using Azure CLI:"
  echo "      # Download current secret"
  echo "      az keyvault secret show --vault-name $VAULT_NAME --name $AZURE_KEY_VAULT_SECRET_NAME --query value -o tsv > secret.json"
  echo ""
  echo "      # Edit secret.json to add missing VITE_* variables above"
  echo ""
  echo "      # Upload updated secret"
  echo "      az keyvault secret set --vault-name $VAULT_NAME --name $AZURE_KEY_VAULT_SECRET_NAME --file secret.json"
  echo ""
  echo "    Or update via Azure Portal:"
  echo "      https://portal.azure.com → Key vaults → $VAULT_NAME → Secrets → $AZURE_KEY_VAULT_SECRET_NAME → New Version"
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
pnpm --filter @central-kitchen/client run build

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

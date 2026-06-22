#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# InnovaPOS – Azure Ubuntu VM Provisioning & Interactive Config Script
#
# Tested on: Ubuntu 22.04 LTS / 24.04 LTS (amd64)
# Run once on your Azure VM as a sudo-capable user (e.g. azureuser):
#   chmod +x scripts/setup-azure-vm.sh
#   ./scripts/setup-azure-vm.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Configuration
APP_DIR="$HOME/innova-pos"
UBUNTU_CODENAME=$(lsb_release -cs)

# ── Colour Helpers ────────────────────────────────────────────────────────────
info()  { echo -e "\e[34m[INFO]\e[0m  $*"; }
ok()    { echo -e "\e[32m[OK]\e[0m    $*"; }
warn()  { echo -e "\e[33m[WARN]\e[0m  $*"; }
die()   { echo -e "\e[31m[ERR]\e[0m   $*" >&2; exit 1; }

# Sanity Checks
[[ $(id -u) -ne 0 ]] || die "Do not run this script as root. Run as a normal user with sudo privileges."

info "Starting Azure VM provisioning for InnovaPOS on Ubuntu $UBUNTU_CODENAME..."

# ── 1. Update Packages & Dependencies ─────────────────────────────────────────
info "Updating system package list..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq
sudo apt-get install -y -qq curl gnupg lsb-release ufw git jq
ok "System packages updated"

# ── 2. Install Azure CLI ──────────────────────────────────────────────────────
if ! command -v az &>/dev/null; then
    info "Installing Azure CLI..."
    curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
    ok "Azure CLI installed successfully"
else
    ok "Azure CLI already present: $(az --version | head -n 1)"
fi

# ── 3. Install Node.js 20 LTS ─────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    info "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ok "Node.js $(node -v) installed"
else
    ok "Node.js $(node -v) already present"
fi

# ── 4. Install pnpm (via Corepack) ────────────────────────────────────────────
info "Configuring pnpm package manager..."
sudo corepack enable
corepack prepare pnpm@9.15.0 --activate
ok "pnpm package manager configured (version: $(pnpm -v))"

# ── 5. Install PM2 Globally ───────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
    info "Installing PM2 globally..."
    sudo npm install -g pm2@latest
    ok "PM2 installed"
else
    ok "PM2 already present: $(pm2 -v)"
fi

# ── 6. Install PM2 Log Rotate Module ──────────────────────────────────────────
info "Configuring PM2 log rotation..."
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size  50M
pm2 set pm2-logrotate:retain    7
pm2 set pm2-logrotate:compress  true
ok "PM2 log rotation configured"

# ── 7. Configure PM2 Systemd Startup ─────────────────────────────────────────
info "Setting up PM2 startup service..."
# Generate systemd startup unit and execute it
STARTUP_CMD=$(pm2 startup systemd -u "$(whoami)" --hp "$HOME" | tail -1)
eval "$STARTUP_CMD"
ok "PM2 systemd service configured to start on boot"

# ── 8. Install MongoDB 7.0 (Local Database) ──────────────────────────────────
if ! command -v mongod &>/dev/null; then
    info "Installing MongoDB 7.0..."
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
        | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes

    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu ${UBUNTU_CODENAME}/mongodb-org/7.0 multiverse" \
        | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

    sudo apt-get update -qq
    sudo apt-get install -y mongodb-org
    sudo systemctl enable --now mongod
    ok "MongoDB 7.0 installed and started locally"
else
    ok "MongoDB already present"
    sudo systemctl enable --now mongod
fi

# ── 9. Install Nginx ──────────────────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
    info "Installing Nginx..."
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    ok "Nginx installed and running"
else
    ok "Nginx already present"
fi

# ── 10. Install Certbot (for SSL Certificates) ────────────────────────────────
if ! command -v certbot &>/dev/null; then
    info "Installing Certbot..."
    sudo apt-get install -y certbot python3-certbot-nginx
    ok "Certbot installed"
else
    ok "Certbot already present"
fi

# ── 11. Configure Firewall (UFW) ──────────────────────────────────────────────
info "Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
# Block MongoDB port 27017 from external access
sudo ufw deny 27017 comment "MongoDB - internal only"
sudo ufw --force enable
ok "Firewall rules activated (SSH, HTTP, and HTTPS open. Internal databases secured.)"

# ── 12. Create Application Directories ─────────────────────────────────────────
info "Creating configuration directories..."
sudo mkdir -p /etc/innovapos
sudo chown -R "$(whoami):$(whoami)" /etc/innovapos

# ── 13. Interactive Configuration Wizard ──────────────────────────────────────
echo ""
info "========================================================================"
info " Starting Interactive Setup Wizard"
info "========================================================================"
echo "This wizard will help you configure your non-secret environment variables"
echo "locally on the VM, build the secrets JSON payload, and upload it directly"
echo "to your Azure Key Vault."
echo ""

prompt_default() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    local val=""
    read -rp "$prompt [$default]: " val
    if [[ -z "$val" ]]; then
        eval "$var_name=\$default"
    else
        eval "$var_name=\$val"
    fi
}

prompt_secret() {
    local prompt="$1"
    local var_name="$2"
    local val=""
    while [[ -z "$val" ]]; do
        read -srp "$prompt: " val
        echo ""
    done
    eval "$var_name=\$val"
}

# Key Vault settings
KV_NAME=""
while [[ -z "$KV_NAME" ]]; do
    read -rp "Enter your Azure Key Vault Name (e.g. my-innovapos-vault): " KV_NAME
done

prompt_default "Enter Key Vault Secret Name" "innovapos-production-env" "KV_SECRET_NAME"

echo ""
info "--- Application Database & Auth Secrets ---"
prompt_secret "Enter MongoDB Connection String (MONGO_URI)" "MONGO_URI"
prompt_secret "Enter JWT Secret (random long string for JWT signing)" "JWT_SECRET"
prompt_secret "Enter Internal Service Key (shared internal auth key)" "INTERNAL_SERVICE_KEY"

echo ""
info "--- Azure Storage Secrets ---"
prompt_default "Enter Azure Storage Account Name" "yourstorageaccount" "STORAGE_ACCOUNT"
prompt_default "Enter Azure Storage Container Name" "uploads" "STORAGE_CONTAINER"

echo ""
info "--- App Domain Configurations ---"
prompt_default "Enter POS App Domain (e.g. pos.example.com)" "pos.example.com" "POS_DOMAIN"
prompt_default "Enter Admin Portal Domain (e.g. admin.example.com)" "admin.example.com" "ADMIN_DOMAIN"
prompt_default "Enter Public Web Domain (e.g. www.example.com)" "www.example.com" "PUBLIC_DOMAIN"
prompt_default "Enter QR Order Web Domain (e.g. order.example.com)" "order.example.com" "QR_DOMAIN"

# ── 14. Configure VM environment variables (non-secrets) ────────────────────
echo ""
info "Configuring VM environment variables (non-secrets)..."
# Back up /etc/environment
sudo cp /etc/environment /etc/environment.bak

add_env_var() {
    local key="$1"
    local val="$2"
    if ! grep -q "^$key=" /etc/environment; then
        echo "$key=\"$val\"" | sudo tee -a /etc/environment >/dev/null
    else
        sudo sed -i "s|^$key=.*|$key=\"$val\"|g" /etc/environment
    fi
}

add_env_var "CLOUD_PROVIDER" "azure"
add_env_var "SECRETS_PROVIDER" "azure"
add_env_var "STORAGE_PROVIDER" "azure"
add_env_var "AZURE_KEY_VAULT_URL" "https://${KV_NAME}.vault.azure.net/"
add_env_var "AZURE_KEY_VAULT_SECRET_NAME" "$KV_SECRET_NAME"

# Write to bootstrap.env for PM2 processes
cat <<EOF > /etc/innovapos/bootstrap.env
# Bootstrap Configuration for InnovaPOS (PM2)
CLOUD_PROVIDER=azure
SECRETS_PROVIDER=azure
STORAGE_PROVIDER=azure
AZURE_KEY_VAULT_URL=https://${KV_NAME}.vault.azure.net/
AZURE_KEY_VAULT_SECRET_NAME=${KV_SECRET_NAME}
EOF

ok "Non-secret environment variables configured in /etc/environment and /etc/innovapos/bootstrap.env"

# ── 15. Authenticate with Azure CLI & Upload Secrets ──────────────────────────
echo ""
info "Azure CLI Authentication..."
echo "To upload secrets to Key Vault, we must authenticate Azure CLI."
echo "If your VM has a System-Assigned Managed Identity enabled and role assignments completed,"
echo "we can sign in using that identity. Otherwise, you can perform an interactive login."
echo ""

LOGIN_SUCCESS=false
read -rp "Do you want to authenticate using the VM Managed Identity? (y/n) [y]: " USE_IDENTITY
USE_IDENTITY=${USE_IDENTITY:-y}

if [[ "$USE_IDENTITY" =~ ^[Yy]$ ]]; then
    info "Attempting Managed Identity login..."
    if az login --identity >/dev/null 2>&1; then
        ok "Successfully signed in via Managed Identity."
        LOGIN_SUCCESS=true
    else
        warn "Managed Identity login failed. We will fall back to interactive sign-in."
    fi
fi

if ! $LOGIN_SUCCESS; then
    info "Performing interactive Azure CLI login. Follow browser prompts..."
    az login
    LOGIN_SUCCESS=true
fi

# Build Key Vault Secret JSON payload
info "Compiling Key Vault secret JSON payload..."
SECRETS_JSON=$(cat <<EOF
{
  "NODE_ENV": "production",
  "SECRETS_PROVIDER": "azure",
  "STORAGE_PROVIDER": "azure",
  "MONGO_URI": "${MONGO_URI}",
  "JWT_SECRET": "${JWT_SECRET}",
  "JWT_EXPIRES_IN": "12h",
  "INTERNAL_SERVICE_KEY": "${INTERNAL_SERVICE_KEY}",
  "CORS_ORIGIN": "https://${POS_DOMAIN},https://${ADMIN_DOMAIN},https://${PUBLIC_DOMAIN},https://${QR_DOMAIN}",
  "UPLOAD_SERVICE_URL": "http://127.0.0.1:3002",
  "AUDIT_SERVICE_URL": "http://127.0.0.1:3004",
  "POS_URL": "https://${POS_DOMAIN}",
  "ADMIN_URL": "https://${ADMIN_DOMAIN}",
  "AZURE_STORAGE_ACCOUNT_NAME": "${STORAGE_ACCOUNT}",
  "AZURE_STORAGE_CONTAINER_NAME": "${STORAGE_CONTAINER}",
  "VITE_POS_URL": "https://${POS_DOMAIN}",
  "VITE_ADMIN_URL": "https://${ADMIN_DOMAIN}",
  "VITE_PUBLIC_WEB_URL": "https://${PUBLIC_DOMAIN}",
  "VITE_QR_ORDER_WEB_ORIGIN": "https://${QR_DOMAIN}",
  "VITE_API_URL": "https://${POS_DOMAIN}/api",
  "VITE_PUBLIC_WEB_API_URL": "https://${PUBLIC_DOMAIN}/api",
  "VITE_QR_ORDER_API_URL": "https://${QR_DOMAIN}/api"
}
EOF
)

# Write securely to a temporary file
TEMP_SECRET_FILE=$(mktemp)
echo "$SECRETS_JSON" > "$TEMP_SECRET_FILE"

# Upload to Key Vault
info "Uploading secret '$KV_SECRET_NAME' to Key Vault '$KV_NAME'..."
if az keyvault secret set --vault-name "$KV_NAME" --name "$KV_SECRET_NAME" --file "$TEMP_SECRET_FILE" >/dev/null; then
    ok "Secret successfully uploaded to Key Vault!"
else
    # Clean up file first
    rm -f "$TEMP_SECRET_FILE"
    die "Failed to upload secret. Check that your user or VM has the 'Key Vault Secrets Officer' role assigned on the Vault."
fi

# Clean up
rm -f "$TEMP_SECRET_FILE"
ok "Cleaned up temporary configuration files."

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
ok "========================================================================"
ok " Setup and Secrets Configuration Complete!"
ok "========================================================================"
echo ""
echo "  Next Steps to Run the Applications:"
echo ""
echo "  1. Clone the repository to your home folder:"
echo "     git clone https://github.com/isuruShan/innova-pos.git $APP_DIR"
echo ""
echo "  2. Go into the cloned folder:"
echo "     cd $APP_DIR"
echo ""
echo "  3. Update the Nginx configurations templates in the cloned repository"
echo "     under the 'nginx/' directory to replace 'server_name' values with"
echo "     your actual domains (e.g. pos.example.com, admin.example.com)."
echo ""
echo "  4. Deploy Nginx config & reload Nginx:"
echo "     ./scripts/deploy-nginx.sh"
echo ""
echo "  5. Deploy & start the application services via PM2:"
echo "     ./scripts/deploy-production.sh"
echo ""
echo "  6. Generate HTTPS SSL certificates with Certbot:"
echo "     sudo certbot --nginx"
echo "========================================================================"
echo ""

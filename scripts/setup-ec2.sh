#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Burger Joint POS – EC2 initial provisioning script
#
# Tested on: Ubuntu 22.04 LTS / 24.04 LTS (amd64)
# Run once as the ubuntu user (or any sudo-capable user):
#   chmod +x scripts/setup-ec2.sh
#   bash scripts/setup-ec2.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/home/ubuntu/pos"
UBUNTU_CODENAME=$(lsb_release -cs)   # jammy | noble | …

# ── Colour helpers ────────────────────────────────────────────────────────────
info()  { echo -e "\e[34m[INFO]\e[0m  $*"; }
ok()    { echo -e "\e[32m[OK]\e[0m    $*"; }
warn()  { echo -e "\e[33m[WARN]\e[0m  $*"; }
die()   { echo -e "\e[31m[ERR]\e[0m   $*" >&2; exit 1; }

[[ $(id -u) -ne 0 ]] || die "Run this script as a normal user (not root). sudo will be called when needed."

# ── 1. System update ──────────────────────────────────────────────────────────
info "Updating system packages…"
sudo apt-get update -qq
sudo apt-get upgrade -y -qq
sudo apt-get install -y -qq curl gnupg lsb-release ufw git

# ── 2. Node.js 20 LTS ─────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    info "Installing Node.js 20 LTS…"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ok "Node $(node -v) installed"
else
    ok "Node $(node -v) already present"
fi

# ── 3. PM2 ────────────────────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
    info "Installing PM2…"
    sudo npm install -g pm2@latest
    ok "PM2 $(pm2 -v) installed"
else
    ok "PM2 $(pm2 -v) already present"
fi

# ── 4. MongoDB 7.0 ───────────────────────────────────────────────────────────
if ! command -v mongod &>/dev/null; then
    info "Installing MongoDB 7.0 for Ubuntu $UBUNTU_CODENAME…"
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
        | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

    # Map Ubuntu codenames to MongoDB-supported distro labels
    case "$UBUNTU_CODENAME" in
        noble)  MONGO_DIST="ubuntu2404" ;;
        jammy)  MONGO_DIST="ubuntu2204" ;;
        focal)  MONGO_DIST="ubuntu2004" ;;
        *)      warn "Unknown Ubuntu codename '$UBUNTU_CODENAME'; defaulting to ubuntu2204"
                MONGO_DIST="ubuntu2204" ;;
    esac

    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu ${UBUNTU_CODENAME}/mongodb-org/7.0 multiverse" \
        | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

    sudo apt-get update -qq
    sudo apt-get install -y mongodb-org
    sudo systemctl enable --now mongod
    ok "MongoDB $(mongod --version | head -1) installed and started"
else
    ok "mongod already present"
    sudo systemctl enable --now mongod
fi

# ── 5. Nginx ──────────────────────────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
    info "Installing Nginx…"
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
    ok "Nginx installed"
else
    ok "Nginx already present"
fi

# ── 6. Certbot (for HTTPS/TLS) ────────────────────────────────────────────────
if ! command -v certbot &>/dev/null; then
    info "Installing Certbot…"
    sudo apt-get install -y certbot python3-certbot-nginx
    ok "Certbot installed"
    warn "Run after DNS is set up: sudo certbot --nginx -d yourdomain.com"
else
    ok "Certbot already present"
fi

# ── 7. Firewall (ufw) ─────────────────────────────────────────────────────────
info "Configuring firewall…"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
# MongoDB must NOT be exposed externally
sudo ufw deny 27017 comment "MongoDB – internal only"
sudo ufw --force enable
ok "Firewall configured (SSH + HTTP/HTTPS open; MongoDB blocked externally)"

# ── 8. App directory ──────────────────────────────────────────────────────────
info "Creating app directory at $APP_DIR…"
sudo mkdir -p "$APP_DIR"
sudo chown "$(id -u):$(id -g)" "$APP_DIR"

# ── 9. PM2 log-rotate module ──────────────────────────────────────────────────
info "Installing pm2-logrotate…"
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size  50M
pm2 set pm2-logrotate:retain    7
pm2 set pm2-logrotate:compress  true

# ── 10. PM2 systemd startup ───────────────────────────────────────────────────
info "Generating PM2 systemd startup unit…"
STARTUP_CMD=$(pm2 startup systemd -u "$(whoami)" --hp "$HOME" | tail -1)
# The command is usually: sudo env PATH=... pm2 startup ...
eval "$STARTUP_CMD" 2>/dev/null || warn "Could not auto-run startup command. Copy and run manually:\n  $STARTUP_CMD"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
ok "======================================================"
ok " EC2 provisioning complete!"
ok "======================================================"
echo ""
echo "  Next steps:"
echo "  1.  Copy your project to $APP_DIR  (git clone or scp)"
echo "  2.  Create $APP_DIR/server/.env  (copy from .env.example, fill in values)"
echo "      - Set a strong JWT_SECRET"
echo "      - Set MONGO_URI if using Atlas"
echo "  3.  Run the deploy script:"
echo "      cd $APP_DIR && bash scripts/deploy.sh"
echo "  4.  (Optional) Add HTTPS:"
echo "      sudo certbot --nginx -d yourdomain.com"
echo ""

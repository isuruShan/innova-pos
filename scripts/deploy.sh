#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Burger Joint POS – deploy / update script
#
# Run from the project root after provisioning with setup-ec2.sh:
#   cd /home/ubuntu/pos
#   bash scripts/deploy.sh
#
# What it does:
#   1. Pull latest code from git
#   2. Install/update server dependencies (prod only)
#   3. Install client dependencies & build React app
#   4. Install/update Nginx site config
#   5. Zero-downtime PM2 reload (or first start)
#   6. Save PM2 process list
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS_DIR="$APP_DIR/logs"

info()  { echo -e "\e[34m[DEPLOY]\e[0m $*"; }
ok()    { echo -e "\e[32m[DEPLOY]\e[0m $*"; }
die()   { echo -e "\e[31m[DEPLOY ERR]\e[0m $*" >&2; exit 1; }

cd "$APP_DIR"

# ── Sanity checks ─────────────────────────────────────────────────────────────
[[ -f "server/.env" ]] \
    || die "server/.env not found. Copy server/.env.example → server/.env and fill in values."

command -v node  &>/dev/null || die "Node.js not found. Run scripts/setup-ec2.sh first."
command -v pm2   &>/dev/null || die "PM2 not found. Run scripts/setup-ec2.sh first."
command -v nginx &>/dev/null || die "Nginx not found. Run scripts/setup-ec2.sh first."

# ── 1. Pull latest code ───────────────────────────────────────────────────────
if git rev-parse --is-inside-work-tree &>/dev/null; then
    info "Pulling latest code…"
    git pull --ff-only
    ok "Git up to date: $(git rev-parse --short HEAD)"
else
    warn() { echo -e "\e[33m[DEPLOY WARN]\e[0m $*"; }
    warn "Not a git repo — skipping git pull."
fi

# ── 2. Create required directories ────────────────────────────────────────────
mkdir -p "$LOGS_DIR" server/uploads

# ── 3. Server dependencies (production only, no devDeps) ─────────────────────
info "Installing server dependencies…"
cd server
npm ci --omit=dev --silent
cd "$APP_DIR"
ok "Server dependencies installed"

# ── 4. Build React client ─────────────────────────────────────────────────────
info "Installing client dependencies…"
cd client
npm ci --silent

info "Building React app…"
npm run build
cd "$APP_DIR"
ok "React build complete → client/dist"

# ── 5. Nginx config ───────────────────────────────────────────────────────────
info "Installing Nginx site config…"
sudo cp nginx/burger-joint.conf /etc/nginx/sites-available/burger-joint
sudo ln -sf /etc/nginx/sites-available/burger-joint \
            /etc/nginx/sites-enabled/burger-joint
# Remove default site if still enabled
sudo rm -f /etc/nginx/sites-enabled/default

# Test before reloading (exits with error if config is invalid)
sudo nginx -t
sudo systemctl reload nginx
ok "Nginx reloaded"

# ── 6. Start or zero-downtime reload PM2 ─────────────────────────────────────
info "Reloading PM2 process…"
if pm2 describe burger-joint-pos &>/dev/null; then
    pm2 reload ecosystem.config.cjs --env production
    ok "PM2 reloaded (zero-downtime)"
else
    pm2 start ecosystem.config.cjs --env production
    ok "PM2 started"
fi

pm2 save
ok "PM2 process list saved"

# ── 7. Health check ───────────────────────────────────────────────────────────
info "Waiting for server to be healthy…"
MAX_TRIES=12
INTERVAL=5
for i in $(seq 1 $MAX_TRIES); do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000/api/health || echo "000")
    if [[ "$HTTP_STATUS" == "200" ]]; then
        ok "Health check passed (HTTP $HTTP_STATUS)"
        break
    fi
    if [[ $i -eq $MAX_TRIES ]]; then
        die "Health check failed after $((MAX_TRIES * INTERVAL))s. Check PM2 logs: pm2 logs"
    fi
    echo "  attempt $i/$MAX_TRIES – status $HTTP_STATUS – retrying in ${INTERVAL}s…"
    sleep $INTERVAL
done

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
ok "========================================="
ok " Deploy complete!  $(date '+%Y-%m-%d %H:%M:%S')"
ok "========================================="
echo ""
echo "  PM2 status:   pm2 status"
echo "  PM2 logs:     pm2 logs burger-joint-pos"
echo "  Nginx errors: sudo tail -f /var/log/nginx/pos-error.log"
echo ""

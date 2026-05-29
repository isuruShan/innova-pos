#!/bin/bash
# Deploy nginx configs to Azure VM
# Usage: ./scripts/deploy-nginx.sh
#
# Strategy:
#   - If a conf already exists on the server (certbot has modified it with SSL),
#     patch only the specific lines that need updating (root, alias, proxy_pass).
#     This preserves certbot-managed SSL blocks.
#   - If a conf does not exist (first deploy on a new VM), create it from the
#     repo template and prompt to run certbot afterwards.

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🔧 Deploying nginx configs for cafinity.io..."
echo "   App root: $ROOT"

sudo rm -f /etc/nginx/sites-enabled/default

FIRST_DEPLOY=false

for conf in pos admin-portal public-web qr-order; do
  dest="/etc/nginx/conf.d/${conf}.conf"

  if sudo test -f "$dest"; then
    echo "Patching existing $conf config (preserving SSL)..."

    # Update root/alias absolute paths to current ROOT
    sudo sed -i -E "s|root  [^;]+/apps/|root  $ROOT/apps/|g" "$dest"
    sudo sed -i -E "s|alias [^;]+/apps/|alias $ROOT/apps/|g" "$dest"
  else
    echo "Creating $conf config (first deploy)..."
    sed "s|__APP_ROOT__|$ROOT|g" "$ROOT/nginx/${conf}.conf" | sudo tee "$dest" > /dev/null
    FIRST_DEPLOY=true
  fi
done

echo "Testing nginx configuration..."
sudo nginx -t

if sudo systemctl is-active --quiet nginx; then
    echo "Reloading nginx..."
    sudo systemctl reload nginx
else
    echo "Starting nginx..."
    sudo systemctl start nginx
fi

echo ""
echo "✅ Nginx configs deployed successfully!"
echo "  - pos.cafinity.io    → POS (port 5000)"
echo "  - admin.cafinity.io  → Admin Portal (port 5001)"
echo "  - www.cafinity.io    → Public Web (port 5002)"
echo "  - shop.cafinity.io   → QR Order (port 5010)"

if $FIRST_DEPLOY; then
    echo ""
    echo "⚠  First deploy detected — add HTTPS with:"
    echo "   sudo certbot --nginx --expand -d www.cafinity.io -d cafinity.io -d pos.cafinity.io -d admin.cafinity.io -d shop.cafinity.io"
fi


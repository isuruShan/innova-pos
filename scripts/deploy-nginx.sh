#!/bin/bash
# Deploy nginx configs to Azure VM
# Usage: ./scripts/deploy-nginx.sh

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🔧 Deploying nginx configs for cafinity.io..."
echo "   App root: $ROOT"

# Remove any old/corrupted configs
echo "Cleaning old configs..."
sudo rm -f /etc/nginx/conf.d/*.conf
sudo rm -f /etc/nginx/conf.d/*.conf.backup
sudo rm -f /etc/nginx/sites-enabled/default

# Copy configs from repo, substituting __APP_ROOT__ with the actual repo path
echo "Copying new configs..."
for conf in pos admin-portal public-web qr-order; do
  sed "s|__APP_ROOT__|$ROOT|g" "$ROOT/nginx/${conf}.conf" | sudo tee "/etc/nginx/conf.d/${conf}.conf" > /dev/null
done

# Test nginx configuration
echo "Testing nginx configuration..."
sudo nginx -t

# Start or reload nginx
if sudo systemctl is-active --quiet nginx; then
    echo "Reloading nginx..."
    sudo systemctl reload nginx
else
    echo "Starting nginx..."
    sudo systemctl start nginx
fi

echo "✅ Nginx configs deployed successfully!"
echo ""
echo "Your subdomains:"
echo "  - pos.cafinity.io    → POS (port 5000)"
echo "  - admin.cafinity.io  → Admin Portal (port 5001)"
echo "  - www.cafinity.io    → Public Web (port 5002)"
echo "  - shop.cafinity.io   → QR Order (port 5010)"
echo ""
echo "Next steps:"
echo "  1. Ensure DNS A records point to this VM's IP"
echo "  2. Add HTTPS with: sudo certbot --nginx -d pos.cafinity.io -d admin.cafinity.io -d www.cafinity.io -d cafinity.io -d shop.cafinity.io"

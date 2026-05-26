#!/bin/bash
# Deploy nginx configs to Azure VM
# Usage: ./scripts/deploy-nginx.sh

set -e

echo "🔧 Deploying nginx configs for cafinity.io..."

# Remove any old/corrupted configs
echo "Cleaning old configs..."
sudo rm -f /etc/nginx/conf.d/*.conf
sudo rm -f /etc/nginx/conf.d/*.conf.backup
sudo rm -f /etc/nginx/sites-enabled/default

# Copy fresh configs from repo
echo "Copying new configs..."
sudo cp nginx/pos.conf /etc/nginx/conf.d/pos.conf
sudo cp nginx/admin-portal.conf /etc/nginx/conf.d/admin-portal.conf
sudo cp nginx/public-web.conf /etc/nginx/conf.d/public-web.conf
sudo cp nginx/qr-order.conf /etc/nginx/conf.d/qr-order.conf

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

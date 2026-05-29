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

# Re-apply existing Let's Encrypt SSL certificates BEFORE reloading nginx.
# Certbot modifies the conf files to add SSL; we do this first so the reload
# below starts nginx with a complete HTTP + HTTPS config in one shot.
if command -v certbot >/dev/null 2>&1 && [ -d /etc/letsencrypt/live ]; then
    echo "Re-applying SSL certificates..."
    for cert_dir in /etc/letsencrypt/live/*/; do
        cert_name=$(basename "$cert_dir")
        [[ "$cert_name" == "README" ]] && continue
        echo "  Installing cert: $cert_name"
        sudo certbot install --nginx --cert-name "$cert_name" --non-interactive 2>&1 \
            | grep -v "^$" | sed 's/^/    /' || \
            echo "  ⚠ Could not auto-install $cert_name — run: sudo certbot install --nginx --cert-name $cert_name"
    done
    # Re-test after certbot modifies the configs
    echo "Re-testing nginx configuration after SSL..."
    sudo nginx -t
fi

# Start or reload nginx
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

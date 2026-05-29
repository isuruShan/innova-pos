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

# Re-apply existing Let's Encrypt SSL certificates.
# Certbot modifies the nginx conf files to add SSL blocks; since we just
# overwrote those files from the repo, we need to re-install each cert.
if command -v certbot >/dev/null 2>&1 && [ -d /etc/letsencrypt/live ]; then
    echo "Re-applying SSL certificates..."
    CERT_APPLIED=false
    for cert_dir in /etc/letsencrypt/live/*/; do
        cert_name=$(basename "$cert_dir")
        [[ "$cert_name" == "README" ]] && continue
        echo "  Installing cert: $cert_name"
        sudo certbot install --nginx --cert-name "$cert_name" --non-interactive 2>/dev/null && CERT_APPLIED=true || \
            echo "  ⚠ Could not auto-install $cert_name — run: sudo certbot install --nginx --cert-name $cert_name"
    done
    if $CERT_APPLIED; then
        echo "SSL certificates re-applied. Reloading nginx..."
        sudo systemctl reload nginx
    fi
else
    echo ""
    echo "Next step — add HTTPS (first deploy only):"
    echo "  sudo certbot --nginx -d pos.cafinity.io -d admin.cafinity.io -d www.cafinity.io -d cafinity.io -d shop.cafinity.io"
fi

echo ""
echo "✅ Nginx configs deployed successfully!"
echo "  - pos.cafinity.io    → POS (port 5000)"
echo "  - admin.cafinity.io  → Admin Portal (port 5001)"
echo "  - www.cafinity.io    → Public Web (port 5002)"
echo "  - shop.cafinity.io   → QR Order (port 5010)"

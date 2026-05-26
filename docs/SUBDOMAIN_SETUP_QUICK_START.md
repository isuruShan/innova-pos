# Quick Setup: Azure VM Subdomain Mapping

**TL;DR:** Map multiple subdomains to one Azure VM IP, use nginx to route based on subdomain.

---

## Step-by-Step Checklist

### □ 1. DNS Setup (5-10 minutes, wait 30-60 min for propagation)

In your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):

**Create A records pointing to your Azure VM public IP:**

```
Type: A    Name: pos      Value: <your-vm-ip>    TTL: 3600
Type: A    Name: admin    Value: <your-vm-ip>    TTL: 3600
Type: A    Name: menu     Value: <your-vm-ip>    TTL: 3600
Type: A    Name: order    Value: <your-vm-ip>    TTL: 3600
Type: A    Name: www      Value: <your-vm-ip>    TTL: 3600
```

Get your VM IP:
```bash
az vm show -d -g <resource-group> -n <vm-name> --query publicIps -o tsv
```

Test DNS:
```bash
dig pos.yourdomain.com    # Should return your VM IP
```

---

### □ 2. Azure NSG (Network Security Group)

Allow inbound ports 80 and 443:

**Azure Portal:**
VM → Networking → Add inbound port rule → Port 80, 443

**Azure CLI:**
```bash
az network nsg rule create -g <rg> --nsg-name <nsg> -n Allow-HTTP \
  --priority 100 --destination-port-ranges 80 --protocol Tcp --access Allow

az network nsg rule create -g <rg> --nsg-name <nsg> -n Allow-HTTPS \
  --priority 110 --destination-port-ranges 443 --protocol Tcp --access Allow
```

**Do NOT expose ports 5000, 5001, 5002, 5010 publicly.**

---

### □ 3. Install nginx on VM

SSH to VM:
```bash
ssh azureuser@<vm-ip>
```

Install nginx:
```bash
# Ubuntu
sudo apt update && sudo apt install -y nginx

# RedHat/CentOS
sudo dnf install -y nginx

# Enable and start
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx    # should show "active (running)"
```

---

### □ 4. Deploy nginx configs

**Option A: Copy from repo (recommended)**

On your VM:
```bash
cd ~/splitsecond-pos

# Edit configs to replace yourdomain.com with your actual domain
nano nginx/pos.conf           # Change: server_name pos.yourdomain.com;
nano nginx/admin-portal.conf  # Change: server_name admin.yourdomain.com;
nano nginx/public-web.conf    # Change: server_name menu.yourdomain.com www.yourdomain.com;
nano nginx/qr-order.conf      # Change: server_name order.yourdomain.com;

# Also update paths: /home/ec2-user/ → /home/azureuser/ (or your user)

# Copy to nginx directory
sudo cp nginx/pos.conf /etc/nginx/conf.d/pos.conf
sudo cp nginx/admin-portal.conf /etc/nginx/conf.d/admin-portal.conf
sudo cp nginx/public-web.conf /etc/nginx/conf.d/public-web.conf
sudo cp nginx/qr-order.conf /etc/nginx/conf.d/qr-order.conf

# Remove default
sudo rm -f /etc/nginx/sites-enabled/default     # Ubuntu
sudo rm -f /etc/nginx/conf.d/default.conf       # RedHat/CentOS

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

**Option B: Full configs in docs/AZURE_DNS_SUBDOMAIN_SETUP.md**

---

### □ 5. Update CORS in Key Vault

Add all your HTTPS subdomains to CORS_ORIGIN:

```json
{
  "CORS_ORIGIN": "https://pos.yourdomain.com,https://admin.yourdomain.com,https://menu.yourdomain.com,https://order.yourdomain.com"
}
```

Reload PM2:
```bash
cd ~/splitsecond-pos
pm2 reload ecosystem.config.cjs --env production
```

---

### □ 6. Test HTTP (before SSL)

```bash
curl http://pos.yourdomain.com
curl http://admin.yourdomain.com
curl http://menu.yourdomain.com
curl http://order.yourdomain.com
```

Visit in browser — should see your apps (HTTP, no lock icon yet).

---

### □ 7. Add HTTPS with Certbot

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx    # Ubuntu
sudo dnf install -y certbot python3-certbot-nginx    # RedHat/CentOS

# Get certificates (replace with your actual domains)
sudo certbot --nginx \
  -d pos.yourdomain.com \
  -d admin.yourdomain.com \
  -d menu.yourdomain.com \
  -d www.yourdomain.com \
  -d order.yourdomain.com \
  --email your-email@example.com \
  --agree-tos \
  --redirect

# Certbot automatically:
# - Obtains SSL certificates
# - Modifies nginx configs to listen on 443
# - Redirects HTTP → HTTPS
# - Sets up auto-renewal
```

Test auto-renewal:
```bash
sudo certbot renew --dry-run
```

---

### □ 8. Verify HTTPS

Visit in browser:
- ✅ `https://pos.yourdomain.com` (should show lock icon)
- ✅ `https://admin.yourdomain.com`
- ✅ `https://menu.yourdomain.com`
- ✅ `https://order.yourdomain.com`

Check redirect:
```bash
curl -I http://pos.yourdomain.com    # Should return 301 → https://
```

---

### □ 9. Update frontend URLs (if needed)

If your frontend .env files reference API URLs, update them:

**apps/pos/client/.env.production:**
```env
VITE_API_URL=https://pos.yourdomain.com/api
```

**apps/admin-portal/client/.env.production:**
```env
VITE_API_URL=https://admin.yourdomain.com/api
```

Rebuild:
```bash
cd ~/splitsecond-pos
pnpm install
pnpm build:pos-client
pnpm build:admin-client
pnpm build:public-web-client
pnpm build:qr-order-client
pm2 reload ecosystem.config.cjs --env production
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ DNS (all point to same VM IP: 20.x.x.x)                        │
│  - pos.yourdomain.com    → A record → 20.x.x.x                 │
│  - admin.yourdomain.com  → A record → 20.x.x.x                 │
│  - menu.yourdomain.com   → A record → 20.x.x.x                 │
│  - order.yourdomain.com  → A record → 20.x.x.x                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Azure VM: 20.x.x.x                                              │
│                                                                 │
│  nginx (ports 80/443) ← inspects Host header                   │
│    ├── pos.yourdomain.com    → proxy_pass → 127.0.0.1:5000    │
│    ├── admin.yourdomain.com  → proxy_pass → 127.0.0.1:5001    │
│    ├── menu.yourdomain.com   → proxy_pass → 127.0.0.1:5002    │
│    └── order.yourdomain.com  → proxy_pass → 127.0.0.1:5010    │
│                                                                 │
│  PM2 (backend Node.js processes)                                │
│    ├── pos-server          (127.0.0.1:5000)                    │
│    ├── admin-server        (127.0.0.1:5001)                    │
│    ├── public-web-server   (127.0.0.1:5002)                    │
│    ├── qr-order-server     (127.0.0.1:5010)                    │
│    ├── auth-service        (127.0.0.1:3001) ← internal only    │
│    ├── upload-service      (127.0.0.1:3002) ← internal only    │
│    └── audit-service       (127.0.0.1:3004) ← internal only    │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- ✅ All subdomains point to **same IP**
- ✅ nginx routes based on **subdomain** (Host header)
- ✅ Backend services bind to **localhost** (not exposed publicly)
- ✅ Internal services (auth/upload/audit) have no nginx config

---

## Troubleshooting

### DNS not resolving
```bash
dig pos.yourdomain.com          # Should return your VM IP
sudo systemd-resolve --flush-caches
```
Wait 5-60 minutes for DNS propagation.

### nginx 502 Bad Gateway
```bash
pm2 list                        # Check PM2 processes are running
pm2 logs pos-server             # Check logs
sudo tail -f /var/log/nginx/error.log
curl http://127.0.0.1:5000      # Test backend directly
```

### CORS errors
- Update CORS_ORIGIN in Key Vault secret (include `https://`)
- Reload PM2: `pm2 reload ecosystem.config.cjs --env production`
- Check browser console for exact origin

### Certbot fails
- Ensure DNS is resolving to your VM
- Check ports 80/443 are open in Azure NSG
- Try one domain at a time:
  ```bash
  sudo certbot --nginx -d pos.yourdomain.com
  ```

---

## Full Documentation

See [AZURE_DNS_SUBDOMAIN_SETUP.md](./AZURE_DNS_SUBDOMAIN_SETUP.md) for complete step-by-step guide with all config examples.

---

## Recommended Subdomains

- `pos.yourdomain.com` → POS (staff access)
- `admin.yourdomain.com` → Admin portal (merchant/super admin)
- `menu.yourdomain.com` or `www.yourdomain.com` → Public restaurant menu
- `order.yourdomain.com` → QR table ordering (guest access)

**Replace `yourdomain.com` with your actual domain!**

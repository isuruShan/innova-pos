# Azure VM DNS + Subdomain Mapping Guide

Complete guide for mapping multiple subdomains to different backend services on a single Azure VM using nginx reverse proxy.

---

## Architecture

```
DNS Records (all point to Azure VM Public IP)
   ├── pos.yourdomain.com       → A record → 20.x.x.x
   ├── admin.yourdomain.com     → A record → 20.x.x.x
   ├── menu.yourdomain.com      → A record → 20.x.x.x
   └── order.yourdomain.com     → A record → 20.x.x.x
                                      ↓
                              Azure VM (20.x.x.x)
                                      ↓
                                   nginx :80/:443
                                      ↓
      ┌───────────────────────────────┼───────────────────────────────┐
      │                               │                               │
   pos.yourdomain.com        admin.yourdomain.com        menu.yourdomain.com
      ↓                               ↓                               ↓
   PM2: pos-server            PM2: admin-server          PM2: public-web-server
   127.0.0.1:5000             127.0.0.1:5001             127.0.0.1:5002
```

**Key concept:** All subdomains point to the **same IP address**. Nginx inspects the `Host` header (subdomain) and routes to the appropriate backend port.

---

## Step 1: Configure DNS Records

In your domain provider's DNS management panel (e.g., GoDaddy, Namecheap, Cloudflare, Azure DNS Zone), create **A records**:

| Type | Name/Host | Value (Azure VM Public IP) | TTL  |
|------|-----------|----------------------------|------|
| A    | pos       | 20.x.x.x                   | 3600 |
| A    | admin     | 20.x.x.x                   | 3600 |
| A    | menu      | 20.x.x.x                   | 3600 |
| A    | order     | 20.x.x.x                   | 3600 |
| A    | www       | 20.x.x.x (optional)        | 3600 |

Replace `20.x.x.x` with your Azure VM's **Public IP address** (found in Azure Portal → VM → Overview).

**Note:** If using **Azure DNS Zone**:
```bash
# Get your VM's public IP
az vm show -d -g <resource-group> -n <vm-name> --query publicIps -o tsv

# Create A records
az network dns record-set a add-record \
  -g <resource-group> \
  -z yourdomain.com \
  -n pos \
  -a 20.x.x.x

az network dns record-set a add-record \
  -g <resource-group> \
  -z yourdomain.com \
  -n admin \
  -a 20.x.x.x

# Repeat for menu, order, etc.
```

**DNS propagation takes 5-60 minutes.** Test with:
```bash
# From your local machine
dig pos.yourdomain.com
dig admin.yourdomain.com

# Should show: pos.yourdomain.com. 3600 IN A 20.x.x.x
```

---

## Step 2: Configure Azure VM Network Security Group (NSG)

Allow inbound traffic on ports 80 and 443 (HTTPS):

### Via Azure Portal:
1. Go to your VM → **Networking** → **Add inbound port rule**
2. Add these rules:

| Priority | Name        | Port | Protocol | Source | Destination | Action |
|----------|-------------|------|----------|--------|-------------|--------|
| 100      | Allow-HTTP  | 80   | TCP      | Any    | Any         | Allow  |
| 110      | Allow-HTTPS | 443  | TCP      | Any    | Any         | Allow  |

### Via Azure CLI:
```bash
# Allow HTTP
az network nsg rule create \
  -g <resource-group> \
  --nsg-name <nsg-name> \
  -n Allow-HTTP \
  --priority 100 \
  --source-address-prefixes '*' \
  --destination-port-ranges 80 \
  --protocol Tcp \
  --access Allow

# Allow HTTPS
az network nsg rule create \
  -g <resource-group> \
  --nsg-name <nsg-name> \
  -n Allow-HTTPS \
  --priority 110 \
  --source-address-prefixes '*' \
  --destination-port-ranges 443 \
  --protocol Tcp \
  --access Allow
```

**Do NOT expose ports 5000, 5001, 5002, 5010** publicly — nginx is the only entry point.

---

## Step 3: Install nginx on Azure VM

SSH into your Azure VM:
```bash
ssh azureuser@20.x.x.x
# or
ssh azureuser@pos.yourdomain.com  (after DNS propagates)
```

Install nginx:

**Ubuntu 22.04/24.04:**
```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

**RedHat/CentOS/Fedora:**
```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

Verify:
```bash
sudo systemctl status nginx    # should show "active (running)"
curl http://localhost           # should return nginx welcome page
```

---

## Step 4: Create nginx Subdomain Configurations

### 4.1 Remove default config
```bash
sudo rm -f /etc/nginx/sites-enabled/default       # Ubuntu
sudo rm -f /etc/nginx/conf.d/default.conf         # RedHat/CentOS
```

### 4.2 Create subdomain configs

We'll create separate config files for each subdomain. All listen on port 80 initially (HTTPS added later).

#### **POS App** → `pos.yourdomain.com`

```bash
sudo nano /etc/nginx/sites-available/pos.conf    # Ubuntu
# OR
sudo nano /etc/nginx/conf.d/pos.conf             # RedHat/CentOS
```

```nginx
upstream pos_backend {
    server 127.0.0.1:5000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name pos.yourdomain.com;

    access_log /var/log/nginx/pos-access.log;
    error_log  /var/log/nginx/pos-error.log;

    client_max_body_size 10M;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API routes → backend
    location /api/ {
        proxy_pass http://pos_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 120s;
    }

    # WebSocket support (if needed)
    location /socket.io/ {
        proxy_pass http://pos_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # React SPA (built frontend)
    location / {
        root /home/azureuser/splitsecond-pos/apps/pos/client/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /home/azureuser/splitsecond-pos/apps/pos/client/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### **Admin Portal** → `admin.yourdomain.com`

```bash
sudo nano /etc/nginx/sites-available/admin.conf    # Ubuntu
# OR
sudo nano /etc/nginx/conf.d/admin.conf             # RedHat/CentOS
```

```nginx
upstream admin_backend {
    server 127.0.0.1:5001;
    keepalive 16;
}

server {
    listen 80;
    listen [::]:80;
    server_name admin.yourdomain.com;

    access_log /var/log/nginx/admin-access.log;
    error_log  /var/log/nginx/admin-error.log;

    client_max_body_size 10M;

    # Security headers (stricter for admin)
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API routes
    location /api/ {
        proxy_pass http://admin_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 120s;
    }

    # React SPA
    location / {
        root /home/azureuser/splitsecond-pos/apps/admin-portal/client/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /home/azureuser/splitsecond-pos/apps/admin-portal/client/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### **Public Web** (Menu/Restaurant Site) → `menu.yourdomain.com`

```bash
sudo nano /etc/nginx/sites-available/public-web.conf    # Ubuntu
# OR
sudo nano /etc/nginx/conf.d/public-web.conf             # RedHat/CentOS
```

```nginx
upstream public_backend {
    server 127.0.0.1:5002;
    keepalive 16;
}

server {
    listen 80;
    listen [::]:80;
    server_name menu.yourdomain.com www.yourdomain.com;

    access_log /var/log/nginx/public-web-access.log;
    error_log  /var/log/nginx/public-web-error.log;

    client_max_body_size 10M;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location /api/ {
        proxy_pass http://public_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 120s;
    }

    location / {
        root /home/azureuser/splitsecond-pos/apps/public-web/client/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /home/azureuser/splitsecond-pos/apps/public-web/client/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### **QR Order** → `order.yourdomain.com`

```bash
sudo nano /etc/nginx/sites-available/qr-order.conf    # Ubuntu
# OR
sudo nano /etc/nginx/conf.d/qr-order.conf             # RedHat/CentOS
```

```nginx
upstream qr_backend {
    server 127.0.0.1:5010;
    keepalive 16;
}

server {
    listen 80;
    listen [::]:80;
    server_name order.yourdomain.com;

    access_log /var/log/nginx/qr-order-access.log;
    error_log  /var/log/nginx/qr-order-error.log;

    client_max_body_size 10M;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location /api/ {
        proxy_pass http://qr_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 120s;
    }

    # WebSocket for real-time order updates
    location /socket.io/ {
        proxy_pass http://qr_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        root /home/azureuser/splitsecond-pos/apps/qr-order/client/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /home/azureuser/splitsecond-pos/apps/qr-order/client/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4.3 Enable configs (Ubuntu only)

```bash
sudo ln -s /etc/nginx/sites-available/pos.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/admin.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/public-web.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/qr-order.conf /etc/nginx/sites-enabled/
```

*Skip this step on RedHat/CentOS — files in `/etc/nginx/conf.d/` are auto-loaded.*

### 4.4 Test and reload nginx

```bash
sudo nginx -t    # Must show "syntax is ok" and "test is successful"
sudo systemctl reload nginx
```

---

## Step 5: Update CORS Configuration

Your backend servers need to allow requests from the new subdomain origins.

**In your Azure Key Vault secret** (`innovapos-production-env`), update:
```json
{
  "CORS_ORIGIN": "https://pos.yourdomain.com,https://admin.yourdomain.com,https://menu.yourdomain.com,https://order.yourdomain.com"
}
```

Then reload PM2:
```bash
cd ~/splitsecond-pos
pm2 reload ecosystem.config.cjs --env production
```

---

## Step 6: Test HTTP (before SSL)

```bash
# From your local machine or VM
curl -H "Host: pos.yourdomain.com" http://20.x.x.x
curl -H "Host: admin.yourdomain.com" http://20.x.x.x
curl http://pos.yourdomain.com
curl http://admin.yourdomain.com
```

Visit in browser:
- `http://pos.yourdomain.com`
- `http://admin.yourdomain.com`
- `http://menu.yourdomain.com`
- `http://order.yourdomain.com`

You should see your apps (without HTTPS warnings for now).

---

## Step 7: Add HTTPS with Let's Encrypt (Certbot)

### 7.1 Install Certbot

**Ubuntu:**
```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

**RedHat/CentOS/Fedora:**
```bash
sudo dnf install -y certbot python3-certbot-nginx
```

### 7.2 Obtain SSL certificates

```bash
sudo certbot --nginx \
  -d pos.yourdomain.com \
  -d admin.yourdomain.com \
  -d menu.yourdomain.com \
  -d www.yourdomain.com \
  -d order.yourdomain.com \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  --redirect
```

**What this does:**
- Obtains SSL certificates from Let's Encrypt
- Automatically modifies your nginx configs to:
  - Listen on port 443 (HTTPS)
  - Redirect HTTP (port 80) → HTTPS
  - Add SSL certificate paths
- Sets up auto-renewal (systemd timer runs `certbot renew` twice daily)

**Answer the prompts:**
- Email: your-email@example.com
- Terms of Service: Yes
- Redirect HTTP to HTTPS: Yes (recommended)

### 7.3 Verify auto-renewal

```bash
sudo certbot renew --dry-run
```

Should output: "Congratulations, all simulated renewals succeeded"

### 7.4 Add HSTS header (after confirming HTTPS works)

Edit each nginx config and uncomment/add:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

Reload nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Step 8: Update Frontend URLs

Your frontend apps need to know the correct API URLs. Update these in your Key Vault secret or environment:

```json
{
  "POS_API_URL": "https://pos.yourdomain.com/api",
  "ADMIN_API_URL": "https://admin.yourdomain.com/api",
  "PUBLIC_WEB_API_URL": "https://menu.yourdomain.com/api",
  "QR_ORDER_API_URL": "https://order.yourdomain.com/api",
  "UPLOAD_SERVICE_URL": "http://127.0.0.1:3002",
  "CORS_ORIGIN": "https://pos.yourdomain.com,https://admin.yourdomain.com,https://menu.yourdomain.com,https://order.yourdomain.com"
}
```

If your frontend builds need these at build time, update `.env.production` files:

**`apps/pos/client/.env.production`:**
```env
VITE_API_URL=https://pos.yourdomain.com/api
```

**`apps/admin-portal/client/.env.production`:**
```env
VITE_API_URL=https://admin.yourdomain.com/api
```

Then rebuild frontends:
```bash
cd ~/splitsecond-pos
pnpm install
pnpm build:pos-client
pnpm build:admin-client
pnpm build:public-web-client
pnpm build:qr-order-client
```

Reload PM2:
```bash
pm2 reload ecosystem.config.cjs --env production
```

---

## Summary: DNS → nginx → PM2 Flow

1. **DNS**: All subdomains point to **same Azure VM IP** (A records)
2. **nginx**: Listens on ports 80/443, inspects `Host` header, routes to different backend ports
3. **PM2**: Runs Node.js servers on localhost ports (5000, 5001, 5002, 5010)
4. **Internal services**: Auth/upload/audit stay on 127.0.0.1, not exposed via nginx

**Port mapping:**
- `pos.yourdomain.com:443` → nginx → `127.0.0.1:5000` (PM2: pos-server)
- `admin.yourdomain.com:443` → nginx → `127.0.0.1:5001` (PM2: admin-server)
- `menu.yourdomain.com:443` → nginx → `127.0.0.1:5002` (PM2: public-web-server)
- `order.yourdomain.com:443` → nginx → `127.0.0.1:5010` (PM2: qr-order-server)

---

## Troubleshooting

### DNS not resolving
```bash
dig pos.yourdomain.com    # Should return your VM IP
nslookup pos.yourdomain.com
```
Wait 5-60 minutes for DNS propagation. Flush local DNS cache:
```bash
sudo systemd-resolve --flush-caches    # Linux
```

### nginx not routing correctly
```bash
sudo nginx -t                          # Check syntax
sudo tail -f /var/log/nginx/error.log  # Check errors
sudo systemctl status nginx
```

### Backend not responding
```bash
pm2 list                               # Check PM2 processes
pm2 logs pos-server                    # Check logs
curl http://127.0.0.1:5000/api/health  # Test backend directly
```

### Certbot fails
- Ensure DNS is resolving to your VM
- Check ports 80/443 are open in NSG
- Try one domain at a time:
  ```bash
  sudo certbot --nginx -d pos.yourdomain.com
  ```

### CORS errors
- Update `CORS_ORIGIN` in Key Vault secret
- Include `https://` protocol
- Reload PM2: `pm2 reload all`
- Check browser console for exact origin mismatch

---

## Next Steps

1. **Monitoring**: Set up Azure Monitor or PM2 Plus for process monitoring
2. **Backups**: Enable Azure VM backups
3. **Firewall**: Consider Azure Firewall or VM-level firewall (ufw/firewalld)
4. **CDN**: Use Azure CDN for static assets (optional)
5. **Logging**: Ship nginx/PM2 logs to Azure Log Analytics

**Recommended domain structure:**
- `pos.yourdomain.com` → POS (staff access)
- `admin.yourdomain.com` → Admin portal (merchant/super admin)
- `menu.yourdomain.com` or `www.yourdomain.com` → Public menu site
- `order.yourdomain.com` → QR table ordering

Replace `yourdomain.com` with your actual domain name throughout all configs!

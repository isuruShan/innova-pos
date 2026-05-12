# Nginx + HTTPS Setup on EC2 (Amazon Linux)

This guide takes you from a bare EC2 instance (Amazon Linux, `ec2-user`) to a
fully running nginx reverse proxy serving all three apps, with HTTPS added the
moment you point a domain at the server.

---

## Architecture

```
Internet
   │
   ▼
EC2 (Elastic IP)
   │
   ▼
nginx
   ├── :80  → POS app       → PM2 pos-server        :5000
   ├── :8080 → Admin portal  → PM2 admin-server      :5001
   └── :8081 → Public web    → PM2 public-web-server :5002
```

Internal services (auth :3001, upload :3002) are **not** exposed through nginx —
they are only called internally by the app servers.

---

## 1. Open EC2 Security Group ports

In the AWS console → EC2 → Security Groups, add **Inbound** rules:

| Type       | Port | Source    |
|------------|------|-----------|
| HTTP       | 80   | 0.0.0.0/0 |
| Custom TCP | 8080 | 0.0.0.0/0 |
| Custom TCP | 8081 | 0.0.0.0/0 |
| HTTPS      | 443  | 0.0.0.0/0 |  ← add now, needed later for SSL

---

## 2. SSH into the instance

```bash
ssh -i your-key.pem ec2-user@YOUR_ELASTIC_IP
```

---

## 3. Install nginx

```bash
sudo dnf update -y
sudo dnf install nginx -y

sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx    # should say "active (running)"
```

---

## 4. Copy the nginx config files

From **your local machine**, push the configs to the EC2:

```bash
# Run this on your local machine from the repo root
scp -i your-key.pem \
  nginx/pos.conf \
  nginx/admin-portal.conf \
  nginx/public-web.conf \
  ec2-user@YOUR_ELASTIC_IP:/tmp/
```

Then on the **EC2 instance**:

```bash
sudo cp /tmp/pos.conf          /etc/nginx/conf.d/pos.conf
sudo cp /tmp/admin-portal.conf /etc/nginx/conf.d/admin-portal.conf
sudo cp /tmp/public-web.conf   /etc/nginx/conf.d/public-web.conf

# Remove the default placeholder page
sudo rm -f /etc/nginx/conf.d/default.conf

sudo nginx -t                  # must print "syntax is ok" + "test is successful"
sudo systemctl reload nginx
```

---

## 5. Deploy and build the apps

On the **EC2 instance**:

```bash
# Clone (or pull) the repo
cd /home/ec2-user
git clone https://github.com/YOUR_ORG/splitsecond-pos.git
cd splitsecond-pos

# Install dependencies
npm install -g pnpm pm2
pnpm install

# Build all React clients
pnpm --filter @pos/client build
pnpm --filter @admin-portal/client build
pnpm --filter @public-web/client build

# Create the logs directory
mkdir -p logs
```

---

## 6. Start all services with PM2

```bash
cd /home/ec2-user/splitsecond-pos

pm2 start ecosystem.config.cjs --env production
pm2 save            # persist the process list across reboots
pm2 startup         # follow the printed command to enable systemd unit
```

Verify everything is up:

```bash
pm2 list            # all processes should be "online"
pm2 logs --lines 50 # check for errors
```

---

## 7. Verify it works

```bash
# POS app
curl -I http://YOUR_ELASTIC_IP/

# Admin portal
curl -I http://YOUR_ELASTIC_IP:8080/

# Public web
curl -I http://YOUR_ELASTIC_IP:8081/
```

You should get `HTTP/1.1 200 OK` from each.

---

## 8. Add HTTPS with Let's Encrypt (requires a domain)

Once you have a domain (e.g. `example.com`) and its DNS A record points to the
Elastic IP, run the following:

### 8a. Install Certbot

```bash
sudo dnf install python3-certbot-nginx -y
```

### 8b. Update each nginx config's `server_name`

Edit `/etc/nginx/conf.d/pos.conf` and replace:
```nginx
server_name _;
```
with:
```nginx
server_name example.com www.example.com;
```

Do the same for admin-portal.conf:
```nginx
server_name admin.example.com;
```

And public-web.conf (if on a separate subdomain):
```nginx
server_name example.com www.example.com;
```

Reload nginx after editing:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 8c. Issue certificates

```bash
# POS / public web (port 80)
sudo certbot --nginx -d example.com -d www.example.com

# Admin portal (Certbot can only work on port 80, so temporarily point the
# admin block to port 80 OR use the standalone method with a DNS challenge)
sudo certbot --nginx -d admin.example.com
```

Certbot will:
1. Automatically edit your nginx configs to add `ssl_certificate` lines
2. Add a port-80 → 443 redirect block
3. Install a cron job that auto-renews every 90 days

### 8d. Enable HSTS (after confirming HTTPS works)

In each nginx conf, uncomment:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

Then reload nginx.

---

## Day-2 operations

| Task | Command |
|------|---------|
| Reload app code (zero downtime) | `pm2 reload ecosystem.config.cjs --env production` |
| Restart a single app | `pm2 restart pos-server` |
| View live logs | `pm2 logs` |
| Check nginx errors | `sudo tail -f /var/log/nginx/pos-error.log` |
| Test nginx config | `sudo nginx -t` |
| Reload nginx | `sudo systemctl reload nginx` |
| Renew SSL cert (manual) | `sudo certbot renew --dry-run` |

---

## Troubleshooting

**502 Bad Gateway** — nginx can reach the port but Node is not running.
Check `pm2 list` and `pm2 logs`.

**404 on page refresh (SPA routes)** — the `try_files $uri $uri/ /index.html`
rule handles this. Confirm the nginx config was reloaded.

**413 Request Entity Too Large** — increase `client_max_body_size` in the
relevant conf file and run `sudo systemctl reload nginx`.

**Permission denied on uploads/** — nginx runs as the `nginx` user. Run:
```bash
sudo chown -R ec2-user:nginx /home/ec2-user/splitsecond-pos/apps/pos/server/uploads
sudo chmod -R 750            /home/ec2-user/splitsecond-pos/apps/pos/server/uploads
```

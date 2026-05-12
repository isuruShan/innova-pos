# Nginx reverse proxy for all Cafinity / Splitsecond POS services

Use **Markdown** (`.md`) for documentation. **MD5** is a checksum format, not a doc format.

This guide places **Nginx** on the same EC2 instance (or on a small proxy instance) in front of your Node processes. Default upstream ports match this repo:

| Service | Port | Typical public exposure |
|---------|------|-------------------------|
| POS API + SPA | `5000` | Yes — staff browsers |
| Admin portal API + SPA | `5001` | Yes — merchant / superadmin |
| Public web API + site | `5002` | Yes — applicants / guests |
| Auth service | `3001` | Often **internal only** (same VPC / `127.0.0.1`) |
| Upload service | `3002` | Often **internal only** (other backends call it) |
| Audit service | `3004` | Usually **internal only** |

Your apps already set **`app.set('trust proxy', 1)`** and read **`X-Forwarded-*`** — correct behind Nginx.

---

## 1. Install Nginx

### Amazon Linux 2023

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
```

### Ubuntu 22.04+

```bash
sudo apt update && sudo apt install -y nginx
sudo systemctl enable nginx
```

---

## 2. DNS

Create **A records** (or CNAME to ALB) pointing to your instance or load balancer:

| Hostname (example) | Backend |
|--------------------|---------|
| `pos.example.com` | POS (`5000`) |
| `admin.example.com` | Admin portal (`5001`) |
| `www.example.com` | Public web (`5002`) |

Internal-only services can stay on **`127.0.0.1`** with **no** public DNS — other Node apps reach them via `UPLOAD_SERVICE_URL=http://127.0.0.1:3002`, etc.

---

## 3. TLS certificates (recommended)

Use **Let’s Encrypt** with Certbot so Nginx terminates HTTPS and proxies to Node over HTTP on localhost.

### Ubuntu (Certbot nginx plugin)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d pos.example.com -d admin.example.com -d www.example.com
```

Renewals are typically handled by a systemd timer (`certbot renew`).

### Amazon Linux

Install Certbot per [EFF docs](https://certbot.eff.org/) for your OS, then obtain certs and reference `fullchain.pem` / `privkey.pem` in the `server` blocks below.

---

## 4. Recommended layout: one `server` per subdomain

Put site configs under **`/etc/nginx/conf.d/`** (Amazon Linux) or **`/etc/nginx/sites-available/`** + symlink to **`sites-enabled`** (Ubuntu).

Below, replace **`example.com`** and paths to TLS files. Upstreams listen on **loopback** — bind Node to `0.0.0.0` or `127.0.0.1` according to your threat model; security groups should **not** expose `5000–5002` publicly if Nginx is the only entry point.

### Shared snippets (optional)

**/etc/nginx/snippets/proxy-params.conf**

```nginx
proxy_http_version 1.1;
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For     $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_read_timeout 120s;
```

Include it in each location: `include snippets/proxy-params.conf;` (adjust path for Amazon Linux).

---

### POS — `pos.example.com` → port `5000`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name pos.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name pos.example.com;

    ssl_certificate     /etc/letsencrypt/live/pos.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pos.example.com/privkey.pem;

    # Large menu images / uploads proxied through POS → upload service; tune as needed
    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:5000;
        include /etc/nginx/snippets/proxy-params.conf;
    }
}
```

---

### Admin portal — `admin.example.com` → port `5001`

```nginx
server {
    listen 80;
    server_name admin.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.example.com;

    ssl_certificate     /etc/letsencrypt/live/admin.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.example.com/privkey.pem;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:5001;
        include /etc/nginx/snippets/proxy-params.conf;
    }
}
```

---

### Public web — `www.example.com` → port `5002`

```nginx
server {
    listen 80;
    server_name www.example.com example.com;
    return 301 https://www.example.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.example.com;

    ssl_certificate     /etc/letsencrypt/live/www.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.example.com/privkey.pem;

    client_max_body_size 15m;

    location / {
        proxy_pass http://127.0.0.1:5002;
        include /etc/nginx/snippets/proxy-params.conf;
    }
}
```

---

## 5. Internal-only backends (no public `server` block)

If **auth**, **upload**, and **audit** are only called from other processes on the **same host**:

- Set env **`AUTH_SERVICE_URL`**, **`UPLOAD_SERVICE_URL`**, **`AUDIT_SERVICE_URL`** to `http://127.0.0.1:PORT`.
- Do **not** open those ports in the **public** security group.
- **Do not** add Nginx `server` blocks for them unless you intentionally expose them (e.g. dedicated internal DNS in VPC).

If another EC2 instance must call upload, use **private IP** + security group rules, or expose upload behind **VPN** / **internal ALB** — not covered here.

---

## 6. CORS and front-end build URLs

In production, set **`CORS_ORIGIN`** to the **browser-facing** origins (comma-separated), e.g.:

```text
https://pos.example.com,https://admin.example.com,https://www.example.com
```

Rebuild Vite clients with **`VITE_*`** URLs that match what users type in the address bar (see `docs/EC2_PRODUCTION_DEPLOY.md`).

---

## 7. Verify and reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Smoke test:

```bash
curl -sI https://pos.example.com/api/health
curl -sI https://admin.example.com/api/health
curl -sI https://www.example.com/health
```

---

## 8. Optional: single host, path-based routing (not recommended)

Serving **`example.com/pos/`**, **`/admin/`**, **`/`** from one hostname requires careful **`vite`** `base` paths and API prefixes; cookie and CORS boundaries are harder. Prefer **separate subdomains** unless you have a strong reason.

---

## 9. Logs

- **Nginx access/error:** `/var/log/nginx/access.log`, `/var/log/nginx/error.log` (paths may vary).
- **Application logs:** per-service files under `LOG_DIR/<service>/` — see **Application logs** in `docs/EC2_PRODUCTION_DEPLOY.md`.

---

## Reference: minimal HTTP-only (testing, no TLS)

```nginx
server {
    listen 80;
    server_name pos.example.com;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Use only behind a trusted network or for temporary testing; production should use **HTTPS**.

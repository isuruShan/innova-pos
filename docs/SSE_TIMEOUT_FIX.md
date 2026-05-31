# Customer Registration Session Fixes

## Issues
1. Getting "session expired" error in the QR code customer registration screen (dual screen mode) with a 504 Gateway Timeout error on the SSE endpoint: `/api/customers/session-checkin-sse/{sessionId}`
2. Customer sessions expiring after 30 minutes due to MongoDB TTL index

## Root Causes

### 1. Nginx Timeout (504 Gateway Timeout)
The nginx reverse proxy was configured with a `proxy_read_timeout` of only 30 seconds, which is too short for Server-Sent Events (SSE) connections. SSE connections need to stay open for several minutes to receive real-time updates.

The SSE endpoint sends keep-alive pings every 15 seconds, but nginx was timing out the connection before enough time passed.

### 2. Session Expiration (MongoDB TTL)
The `CustomerSessionCheckin` model had a MongoDB TTL index set to automatically delete documents after 30 minutes (1800 seconds). This was too short for customers who might:
- Experience network delays
- Get distracted during registration  
- Face nginx timeout issues
- Take time to complete their information

## Solutions

### Solution 1: Extended Nginx Timeout for SSE
Added a specific nginx location block for SSE endpoints with extended timeouts (10 minutes) and proper SSE-specific settings.

```nginx
# SSE endpoints need longer timeouts for long-lived connections
location ~ ^/api/customers/session-checkin-sse/ {
    proxy_pass         http://pos_backend;
    proxy_http_version 1.1;
    proxy_set_header   Connection        "";
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;

    # SSE-specific settings
    proxy_read_timeout    600s;  # 10 minutes for SSE connections
    proxy_connect_timeout  5s;
    proxy_send_timeout    600s;  # 10 minutes
    proxy_buffering       off;   # Disable buffering for SSE
    proxy_cache           off;   # No caching for SSE

    add_header Cache-Control "no-store, no-cache, must-revalidate";
}
```

### Solution 2: Increased Session Expiration Time
Increased the MongoDB TTL index from 30 minutes (1800 seconds) to 2 hours (7200 seconds) in both:
- `apps/pos/server/src/models/CustomerSessionCheckin.js`
- `apps/public-web/server/src/models/CustomerSessionCheckin.js`

```javascript
// Before: 30 minutes
customerSessionCheckinSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1800 });

// After: 2 hours
customerSessionCheckinSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7200 });
```

**Note:** After deploying this change, you need to restart the application servers for the MongoDB index change to take effect. The new TTL will apply to new sessions created after the restart.

## Deployment Instructions

### Step 1: Update Application Code (Session Expiration Fix)

This has already been updated in the codebase. After pulling the latest changes:

```bash
cd /home/innovapos-production-env/innova-pos
git pull origin main

# Restart the servers to apply the MongoDB index change
pm2 restart all
```

### Step 2: Fix Nginx Configuration (SSE Timeout Fix)

### For Production VM (pos.cafinity.io)

**RECOMMENDED METHOD: Manual Edit (Safest - preserves your working SSL config)**

1. **Backup current configuration:**
   ```bash
   sudo cp /etc/nginx/conf.d/pos.conf /etc/nginx/conf.d/pos.conf.backup
   ```

2. **Edit the configuration file:**
   ```bash
   sudo nano /etc/nginx/conf.d/pos.conf
   ```

3. **Add the SSE timeout configuration:**
   
   Find the line that says `location /api/ {` and add this BEFORE it:
   
   ```nginx
   # SSE endpoints need longer timeouts for long-lived connections
   location ~ ^/api/customers/session-checkin-sse/ {
       proxy_pass         http://pos_backend;
       proxy_http_version 1.1;
       proxy_set_header   Connection        "";
       proxy_set_header   Host              $host;
       proxy_set_header   X-Real-IP         $remote_addr;
       proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
       proxy_set_header   X-Forwarded-Proto $scheme;

       # SSE-specific settings
       proxy_read_timeout    600s;  # 10 minutes for SSE connections
       proxy_connect_timeout  5s;
       proxy_send_timeout    600s;  # 10 minutes
       proxy_buffering       off;   # Disable buffering for SSE
       proxy_cache           off;   # No caching for SSE

       add_header Cache-Control "no-store, no-cache, must-revalidate";
   }
   ```
   
   Save and exit (Ctrl+X, then Y, then Enter)

4. **Test the configuration:**
   ```bash
   sudo nginx -t
   ```

5. **If the test passes, reload nginx:**
   ```bash
   sudo systemctl reload nginx
   ```

6. **Verify the fix:**
   - Open the POS cashier screen
   - Initiate customer registration with QR code
   - The SSE connection should now stay open without timing out

### For Docker Deployment

1. **Rebuild and restart the nginx container:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build nginx
   ```

### Files Updated
- `/nginx/pos.conf` (development)
- `/nginx/production_vm/pos.conf` (production VM)
- `/docker/nginx/conf.d/pos.conf` (docker dev)
- `/docker/nginx/prod/conf.d/pos.conf` (docker production)

## Testing
After deployment:
1. Restart the application servers: `pm2 restart all`
2. Access the POS at https://pos.cafinity.io
3. Go to New Order (cashier screen)
4. Start customer registration via QR code
5. Wait 60+ seconds (simulate network delay)
6. Complete registration on the customer screen
7. The cashier screen should receive the notification without timeout errors
8. Sessions should remain valid for up to 2 hours

## What Was Fixed
- ✅ **Nginx SSE timeout:** Connections now stay open for 10 minutes instead of 30 seconds
- ✅ **Session expiration:** Customer sessions now expire after 2 hours instead of 30 minutes
- ✅ **SSE keep-alive:** Properly configured with `proxy_buffering off` and `proxy_cache off`
- ✅ **Both applications updated:** Changes applied to both POS and Public Web servers

## Additional Notes
- The SSE connection now stays open for up to 10 minutes (600 seconds)
- Keep-alive pings are sent every 15 seconds from the server
- Customer registration sessions are valid for 2 hours
- This prevents both nginx timeouts and premature session expiration
- Regular API calls still use the standard 30-second timeout
- **Important:** After deploying, restart PM2 processes: `pm2 restart all`

## Troubleshooting

### If nginx reload fails with certificate errors:
The pre-made config files assume SSL certificates exist. If you don't have them, use the **manual edit method** above instead of copying the entire config file.

### To restore the working config if something breaks:
```bash
sudo cp /etc/nginx/conf.d/pos.conf.backup /etc/nginx/conf.d/pos.conf
sudo systemctl reload nginx
```

### Example of where to add the SSE block:
Your config should look like this after editing:

```nginx
# ... other config above ...

    # SSE endpoints need longer timeouts for long-lived connections
    location ~ ^/api/customers/session-checkin-sse/ {
        # ... SSE config here ...
    }
    
    location /api/ {
        # ... existing API proxy config ...
    }

# ... rest of config below ...
```

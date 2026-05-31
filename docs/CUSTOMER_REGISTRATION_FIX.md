# Customer Registration QR Code - Complete Fix Guide

## Issues Fixed

### ✅ Issue 1: 404 Error - Double `/api/api/` prefix
- **Symptom:** `POST /api/api/customer-checkin/initiate 404 (Not Found)`
- **Root Cause:** Axios baseURL was `/api` but endpoints also included `/api/`
- **Fix:** Removed `/api` prefix from endpoint calls in CustomerCheckin.jsx

### ✅ Issue 2: Session Expiration (30 minutes too short)
- **Symptom:** "Session expired or invalid" after 30 minutes
- **Root Cause:** MongoDB TTL index auto-deleted sessions after 30 minutes
- **Fix:** Increased to 2 hours (7200 seconds)

### ⚠️ Issue 3: Nginx SSE Timeout (504 Gateway Timeout)
- **Symptom:** Gateway timeout after 30 seconds on SSE endpoint
- **Root Cause:** Nginx `proxy_read_timeout` too short for long-lived SSE connections
- **Fix:** Config updated, needs manual deployment

### ⚠️ Issue 4: Customer Registration Completes But Cashier Not Notified
- **Symptom:** Customer successfully registers but cashier screen doesn't update
- **Root Cause:** Public-web server using `POS_URL` (public HTTPS endpoint) for internal API calls
- **Fix:** Code updated to use `POS_URL` environment variable

## Architecture Flow

```
Customer (public-web client)
    ↓ registers
Public-Web Server (port 5002)
    ↓ calls /api/customers/session-checkin-trigger/:sessionId
POS Server (port 5000)
    ↓ sends SSE event
Cashier (POS client listening via EventSource)
    ↓ receives CHECKIN_COMPLETE event
    ✓ Updates order with customer info
```

The public-web server uses the `POS_URL` environment variable to communicate with the POS server's API.

## Files Changed

### Code Changes (Already Committed)
- ✅ `apps/pos/server/src/models/CustomerSessionCheckin.js` - Increased TTL to 2 hours
- ✅ `apps/public-web/server/src/models/CustomerSessionCheckin.js` - Increased TTL to 2 hours  
- ✅ `apps/public-web/client/src/pages/CustomerCheckin.jsx` - Fixed double API prefix
- ✅ `apps/public-web/server/src/routes/customerCheckin.js` - Updated to use POS_URL
- ✅ `secrets.example.json` - Updated documentation
- ✅ `ecosystem.config.cjs` - Uses POS_URL from secrets

### Config Changes (Need Manual Deployment)
- ⚠️ Production secrets (Azure Key Vault / AWS Secrets Manager) - Ensure POS_URL is correct
- ⚠️ Nginx config - Add SSE timeout block

## Deployment Instructions

### Step 1: Verify POS_URL in Production Secrets

The `POS_URL` should be set to your POS server's public URL (e.g., `https://pos.cafinity.io`).

**Option A: Azure Key Vault** (Recommended for Azure VM)

1. Get your current secrets:
```bash
az keyvault secret show \
  --vault-name YOUR-VAULT-NAME \
  --name innovapos-production-env \
  --query value -o tsv > current-secrets.json
```

2. Verify `POS_URL` is set correctly:
```json
{
  "POS_URL": "https://pos.cafinity.io",
  ... rest of your secrets ...
}
```

3. If missing or incorrect, update and upload:
```bash
az keyvault secret set \
  --vault-name YOUR-VAULT-NAME \
  --name innovapos-production-env \
  --file current-secrets.json
```

**Option B: AWS Secrets Manager** (For AWS EC2)

```bash
# Get current secret
aws secretsmanager get-secret-value \
  --secret-id your-secret-id \
  --query SecretString \
  --output text > current-secrets.json

# Verify POS_URL is set correctly
# Edit if needed

# Update secret
aws secretsmanager update-secret \
  --secret-id your-secret-id \
  --secret-string file://current-secrets.json
```

### Step 2: Pull Code Changes and Restart Services

```bash
# Navigate to your project
cd /home/innovapos-production-env/innova-pos

# Pull all fixes
git pull origin main

# Restart all services to:
# - Apply MongoDB TTL index change (2 hours)
# - Load updated POS_URL environment variable
# - Apply API prefix fix from public-web client rebuild
pm2 restart all

# Verify all services are running
pm2 status
```

### Step 3: Deploy Public-Web Client Build

The public-web client has been rebuilt with the API prefix fix. Deploy it:

```bash
# If using nginx to serve static files
sudo cp -r apps/public-web/client/dist/* /path/to/nginx/public-web/root/

# Or if using a specific deployment directory
sudo rsync -av apps/public-web/client/dist/ /var/www/public-web/

# Verify files are updated
ls -lh /path/to/nginx/public-web/root/assets/
```

### Step 4: Fix Nginx SSE Timeout

Edit your nginx config:

```bash
sudo nano /etc/nginx/conf.d/pos.conf
```

Find `location /api/ {` and add this **BEFORE** it:

```nginx
    # SSE endpoints need longer timeouts for real-time updates
    location ~ ^/api/customers/session-checkin-sse/ {
        proxy_pass         http://pos_backend;
        proxy_http_version 1.1;
        proxy_set_header   Connection        "";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # Extended timeouts for SSE
        proxy_read_timeout    600s;  # 10 minutes
        proxy_connect_timeout  5s;
        proxy_send_timeout    600s;
        proxy_buffering       off;   # Critical for SSE
        proxy_cache           off;

        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

```

Save and test:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Testing the Complete Flow

### Test 1: Customer Registration (404 Fix)
1. Open cashier screen: https://pos.cafinity.io
2. Go to New Order
3. Click "Register New Customer" (QR code icon)
4. Customer screen opens at https://www.cafinity.io
5. ✅ Should NOT get 404 error
6. Enter customer details and submit
7. ✅ Should successfully complete registration

### Test 2: SSE Notification (POS_URL Fix)
1. Complete the registration as above
2. Watch the cashier screen
3. ✅ Should automatically receive notification
4. ✅ Customer should be added to the order
5. ✅ Customer name should appear in the order details

### Test 3: Session Longevity (TTL Fix)
1. Start registration but don't complete it
2. Wait 35+ minutes
3. Complete the registration
4. ✅ Should NOT get "session expired" error
5. ✅ Session should remain valid for up to 2 hours

### Test 4: SSE Connection Stability (Nginx Fix)
1. Start registration
2. Let the connection idle for 60+ seconds
3. Complete registration
4. ✅ Should NOT get 504 Gateway Timeout
5. ✅ Cashier should receive notification promptly

## Troubleshooting

### Problem: Still getting 404 error
**Solution:** Public-web client not deployed
```bash
cd apps/public-web/client
npm run build
sudo cp -r dist/* /path/to/nginx/public-web/root/
```

### Problem: Customer registers but cashier not notified
**Solutions:**
1. Check if `POS_URL` is in production secrets and accessible:
   ```bash
   # Check public-web-server logs
   pm2 logs public-web-server --lines 50
   # Should see successful POST to POS server
   ```

2. Verify services can communicate:
   ```bash
   # From the server, test internal connection
   curl http://127.0.0.1:5000/api/health
   curl http://127.0.0.1:5002/api/health
   ```

3. Check SSE endpoint is accessible:
   ```bash
   # Test SSE endpoint (should hang with keep-alive)
   curl -N http://127.0.0.1:5000/api/customers/session-checkin-sse/test-session-id
   ```

### Problem: Session expires too quickly
**Solution:** Services not restarted after MongoDB index change
```bash
pm2 restart all
# New sessions created after restart will use 2-hour TTL
```

### Problem: 504 Gateway Timeout on SSE
**Solution:** Nginx config not applied
```bash
sudo nginx -t  # Verify syntax
sudo systemctl reload nginx
# Check nginx logs
sudo tail -f /var/log/nginx/pos-error.log
```

## What Each Fix Accomplishes

| Fix | Impact | Required Action |
|-----|--------|-----------------|
| API prefix fix | Eliminates 404 errors | Deploy public-web client build |
| MongoDB TTL | Sessions last 2 hours | Restart PM2 services |
| POS_URL usage | Enables cashier notifications | Verify secrets + restart |
| Nginx SSE timeout | Prevents connection drops | Edit nginx config |

## Summary

All code changes are committed. To complete the deployment:

1. ✅ Verify `POS_URL` is set correctly in production secrets (should be `https://pos.cafinity.io`)
2. ✅ Run `git pull && pm2 restart all`
3. ✅ Deploy public-web client build
4. ✅ Add SSE nginx block and reload nginx

After these steps, the complete customer registration flow will work correctly!

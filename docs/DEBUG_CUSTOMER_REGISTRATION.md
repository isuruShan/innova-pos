# Debugging Customer Registration (QR Code → POS Order)

## The Flow

```
1. Cashier creates order → generates QR code with sessionId
2. Customer scans QR → opens public-web/client (www.cafinity.io)
3. Customer fills form → POST /api/customer-checkin/initiate
4. Customer verifies OTP → POST /api/customer-checkin/verify
5. Public-web server → POST {POS_URL}/api/customers/session-checkin-trigger/{sessionId}
6. POS server publishes event → Redis (if cluster) or in-memory
7. Cashier's SSE listener → receives event → updates order
```

## Prerequisites Checklist

### ✅ 1. Check POS_URL Configuration

**On server:**
```bash
pm2 logs public-web-server --lines 20 | grep "customer-checkin"
```

**Should see:**
```
[customer-checkin] Will trigger POS server at: https://pos.cafinity.io
```

**If you see `http://localhost:5000`**, POS_URL is not configured!

**Fix:** Add to Azure Key Vault secrets:
```json
{
  "POS_URL": "https://pos.cafinity.io"
}
```

Then restart: `pm2 restart public-web-server`

### ✅ 2. Check Redis Configuration (CRITICAL for PM2 Cluster)

Your POS server runs with **2 instances** (cluster mode), so Redis is **REQUIRED** for SSE to work.

**Check logs:**
```bash
pm2 logs pos-server --lines 50 | grep "notification-bus"
```

**Expected output (GOOD):**
```
[notification-bus] Redis pub/sub ready for notification SSE
```

**If you see this (BAD for cluster mode):**
```
[notification-bus] in-process only (set REDIS_URL for cluster SSE)
```

**Fix:** Add to Azure Key Vault secrets:
```json
{
  "REDIS_URL": "redis://your-redis-host:6379"
}
```

Then restart: `pm2 restart pos-server`

### ✅ 3. Check Nginx SSE Timeout Configuration

**On server:**
```bash
cat /etc/nginx/conf.d/pos.conf | grep -A 10 "session-checkin-sse"
```

**Should have:**
```nginx
location ~ ^/api/customers/session-checkin-sse/ {
    proxy_pass         http://pos_backend;
    proxy_read_timeout 600s;  # 10 minutes
    proxy_buffering    off;
    proxy_cache        off;
}
```

**If missing:** See [docs/CUSTOMER_REGISTRATION_FIX.md](CUSTOMER_REGISTRATION_FIX.md#step-4-fix-nginx-sse-timeout)

## Debugging Steps

### Step 1: Test Customer Registration

1. **Start monitoring logs in separate terminals:**

```bash
# Terminal 1: Public-web server
pm2 logs public-web-server --lines 0

# Terminal 2: POS server
pm2 logs pos-server --lines 0
```

2. **Complete a customer registration**

3. **Check public-web logs** - You should see:
```
[customer-checkin] Triggering POS at https://pos.cafinity.io/api/customers/session-checkin-trigger/{sessionId}
[customer-checkin] POS trigger successful for session {sessionId}
```

4. **Check POS logs** - You should see:
```
[session-checkin-sse] Client connected for session: {sessionId}
[session-checkin-trigger] Received trigger for session: {sessionId}
[session-checkin-trigger] Publishing event for session {sessionId}, customer: {customerId}
[session-checkin-sse] Sending event to client for session {sessionId}
```

### Step 2: Identify the Break Point

#### ❌ **If public-web shows:**
```
[customer-checkin] Failed to trigger POS: connect ECONNREFUSED
```
**Problem:** POS_URL is wrong or POS server is down
**Fix:** Verify POS_URL in secrets, check POS server is running

#### ❌ **If public-web shows:**
```
[customer-checkin] Failed to trigger POS: getaddrinfo ENOTFOUND localhost
```
**Problem:** POS_URL not set (defaulting to localhost)
**Fix:** Add POS_URL to production secrets

#### ❌ **If POS never logs "Received trigger"**
**Problem:** Trigger request not reaching POS server
**Fix:** Check nginx routing, verify POS server is accessible

#### ❌ **If POS logs "Received trigger" but no "Publishing event"**
**Problem:** Session not found in database or status check failed
**Fix:** Check MongoDB TTL, verify session exists with status='completed'

#### ❌ **If POS logs "Publishing event" but cashier doesn't receive it**
**Problem:** Redis not configured (cluster mode requires Redis)
**Fix:** Configure REDIS_URL and restart pos-server

#### ❌ **If SSE never logs "Client connected"**
**Problem:** Cashier's EventSource not connecting
**Fix:** Check browser console for SSE connection errors, verify nginx SSE config

### Step 3: Manual Test

**Test the trigger endpoint directly:**

```bash
# Get a recent session ID from MongoDB
mongo # or mongosh
use innovapos
db.customersessioncheckins.findOne({}, {sessionId: 1})

# Test trigger endpoint
SESSION_ID="your-session-id-here"
curl -X POST https://pos.cafinity.io/api/customers/session-checkin-trigger/$SESSION_ID
```

**Expected response:**
```json
{"success": true, "customer": {...}}
```

**Check if POS logs show the event was published.**

### Step 4: Test SSE Connection

**Open browser console on cashier screen:**

```javascript
// Check if EventSource is connected
const es = new EventSource('/api/customers/session-checkin-sse/test-session-id');
es.onopen = () => console.log('SSE Connected');
es.onerror = (err) => console.error('SSE Error:', err);
es.onmessage = (msg) => console.log('SSE Message:', msg.data);
```

**Should see keep-alive pings every 15 seconds.**

## Common Issues

### Issue: "Customer registered but nothing happens on POS"

**Most likely causes (in order):**

1. **POS_URL not configured** → Public-web can't find POS server
   - Check: `pm2 logs public-web-server | grep "Will trigger"`
   - Should show your actual POS URL, not `localhost:5000`

2. **Redis not configured** → Events don't reach other PM2 workers
   - Check: `pm2 logs pos-server | grep "notification-bus"`
   - Should show "Redis pub/sub ready", not "in-process only"

3. **Nginx blocking SSE** → Connection times out
   - Check: Browser Network tab for 504 errors
   - Should have SSE-specific nginx block

4. **SSE client not listening** → Cashier screen not subscribed
   - Check: Browser console for errors
   - Should see EventSource connection established

### Issue: "Session expired or invalid"

**Cause:** MongoDB TTL deleted the session (was 30min, now 2 hours)

**Fix:** Restart services to apply new TTL:
```bash
pm2 restart pos-server public-web-server
```

### Issue: "404 Cannot POST /api/api/customer-checkin/..."

**Cause:** Double `/api/` prefix (already fixed)

**Fix:** Deploy updated public-web client build

## Deployment Checklist

To fix customer registration completely:

- [ ] Add `POS_URL: "https://pos.cafinity.io"` to production secrets
- [ ] Add `REDIS_URL: "redis://your-redis:6379"` to production secrets (required for cluster mode)
- [ ] Run `git pull origin main` on production server
- [ ] Run `pm2 restart all` to apply changes
- [ ] Verify nginx has SSE timeout block (see CUSTOMER_REGISTRATION_FIX.md)
- [ ] Test: complete registration and verify cashier screen updates

## Quick Diagnostic Command

```bash
echo "=== Checking Configuration ==="
pm2 logs public-web-server --lines 50 | grep "customer-checkin.*Will trigger"
pm2 logs pos-server --lines 50 | grep "notification-bus"
echo ""
echo "=== Testing Registration Flow ==="
echo "1. Complete a customer registration now..."
echo "2. Watch these logs:"
pm2 logs --lines 20 | grep -E "customer-checkin|session-checkin"
```

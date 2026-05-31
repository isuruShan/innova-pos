# SSE Timeout Fix - Customer Registration Screen

## Issue
Getting "session expired" error in the QR code customer registration screen (dual screen mode) with a 504 Gateway Timeout error on the SSE endpoint: `/api/customers/session-checkin-sse/{sessionId}`

## Root Cause
The nginx reverse proxy was configured with a `proxy_read_timeout` of only 30 seconds, which is too short for Server-Sent Events (SSE) connections. SSE connections need to stay open for several minutes to receive real-time updates.

The SSE endpoint sends keep-alive pings every 15 seconds, but nginx was timing out the connection before enough time passed.

## Solution
Added a specific nginx location block for SSE endpoints with extended timeouts (10 minutes) and proper SSE-specific settings:

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

## Deployment Instructions

### For Production VM (pos.cafinity.io)

1. **Backup current configuration:**
   ```bash
   sudo cp /etc/nginx/conf.d/pos.conf /etc/nginx/conf.d/pos.conf.backup
   ```

2. **Update the configuration:**
   ```bash
   cd /home/innovapos-production-env/innova-pos
   sudo cp nginx/production_vm/pos.conf /etc/nginx/conf.d/pos.conf
   ```

3. **Test the configuration:**
   ```bash
   sudo nginx -t
   ```

4. **If the test passes, reload nginx:**
   ```bash
   sudo systemctl reload nginx
   ```

5. **Verify the fix:**
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
1. Access the POS at https://pos.cafinity.io
2. Go to New Order (cashier screen)
3. Start customer registration via QR code
4. Wait 60+ seconds
5. Complete registration on the customer screen
6. The cashier screen should receive the notification without timeout errors

## Additional Notes
- The SSE connection now stays open for up to 10 minutes (600 seconds)
- Keep-alive pings are sent every 15 seconds from the server
- This prevents both nginx and client-side timeouts
- Regular API calls still use the standard 30-second timeout

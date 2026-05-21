# Cross-App URL Configuration Fix

## Summary

Fixed environment variable configuration for cross-app navigation between POS, Admin Portal, Public Web, and QR Order applications. All applications now use the `@innovapos/app-urls` package which reads from VITE_* environment variables.

## Problems Fixed

1. **QR Codes Using Wrong Base URL**: QR codes in the POS were not using the correct environment variable for the QR order app
2. **Sign-In Links Pointing to Wrong URLs**: Public web sign-in modal was not properly configured with production URLs
3. **Admin Portal POS Link Not Working**: Admin portal's "Open POS" link was not using correct production URL
4. **Incomplete Environment Variable Documentation**: .env.example files and documentation were missing critical cross-app URL variables

## What Was Changed

### 1. Updated `.env.example` Files

All client application `.env.example` files now include comprehensive cross-app navigation URLs:

- **`apps/pos/client/.env.example`**: Added VITE_ADMIN_URL, VITE_QR_ORDER_WEB_ORIGIN, VITE_PUBLIC_WEB_URL, VITE_POS_URL
- **`apps/admin-portal/client/.env.example`**: Added VITE_POS_URL, VITE_PUBLIC_WEB_URL, VITE_QR_ORDER_WEB_ORIGIN
- **`apps/public-web/client/.env.example`**: Added VITE_ADMIN_URL, VITE_POS_URL (required for Sign In modal)
- **`apps/qr-order/client/.env.example`**: Added optional URLs for cross-linking

### 2. Updated `deploy.env.example`

Added comprehensive production URL configuration template with all required VITE_* environment variables:

```bash
# Production URLs (update these to match your deployment)
VITE_POS_URL=http://3.210.65.252:5000
VITE_ADMIN_URL=http://3.210.65.252:5001
VITE_PUBLIC_WEB_URL=http://3.210.65.252:5002
VITE_QR_ORDER_WEB_ORIGIN=http://3.210.65.252:5010
```

### 3. Updated Documentation

- **`docs/EC2_PRODUCTION_DEPLOY.md`**: Added comprehensive build commands with all environment variables
- **`docs/ENV_VARIABLES.md`**: Added detailed sections for each client app with required vs optional URLs

## How It Works

### Architecture

All applications use the `@innovapos/app-urls` package (`packages/app-urls/src/browser.js`):

```javascript
// Functions available:
getPosUrl()              // Returns VITE_POS_URL
getAdminUrl()            // Returns VITE_ADMIN_URL
getPublicWebUrl()        // Returns VITE_PUBLIC_WEB_URL
getQrOrderWebOrigin()    // Returns VITE_QR_ORDER_WEB_ORIGIN
```

### Current Implementation Status

✅ **POS Client** (`apps/pos/client/src/pages/manager/CafeTablesPage.jsx`):
- Uses `getQrOrderWebOrigin()` for QR code generation
- QR codes will point to correct guest order app

✅ **Admin Portal** (`apps/admin-portal/client/src/components/layout/Layout.jsx` & `DashboardPage.jsx`):
- Uses `getPosUrl()` for "Open POS" links
- Links will work correctly when environment variables are set

✅ **Public Web** (`apps/public-web/client/src/components/SignInPortalModal.jsx`):
- Uses `getAdminUrl()` and `getPosUrl()` for Sign In modal
- Modal tiles will link to correct portals

## What You Need To Do

### For Development (already working)

Development already works correctly with localhost URLs in `.env.example` files. No action needed.

### For Production Deployment

#### Option 1: Using `deploy.env` (Recommended)

1. Copy `deploy.env.example` to `deploy.env` in repo root:
   ```bash
   cp deploy.env.example deploy.env
   ```

2. Edit `deploy.env` with your production URLs:
   ```bash
   # Replace with your actual domain or IP
   export EIP=your-domain.com  # or IP like 3.210.65.252

   # Production URLs
   VITE_POS_URL=https://${EIP}  # or http://${EIP}:5000 if using IP+port
   VITE_ADMIN_URL=https://admin.${EIP}  # or http://${EIP}:5001
   VITE_PUBLIC_WEB_URL=https://www.${EIP}  # or http://${EIP}:5002
   VITE_QR_ORDER_WEB_ORIGIN=https://order.${EIP}  # or http://${EIP}:5010
   ```

3. Run the deployment script (which sources `deploy.env`):
   ```bash
   ./scripts/deploy-production.sh
   ```

#### Option 2: Manual Build with Environment Variables

Set environment variables before building each client:

```bash
export EIP=your-domain.com

# Build POS client
cd apps/pos/client
VITE_API_URL=https://pos.${EIP}/api \
VITE_ADMIN_URL=https://admin.${EIP} \
VITE_QR_ORDER_WEB_ORIGIN=https://order.${EIP} \
VITE_PUBLIC_WEB_URL=https://www.${EIP} \
VITE_POS_URL=https://pos.${EIP} \
pnpm run build

# Build Admin portal client
cd ../../admin-portal/client
VITE_API_URL=https://admin.${EIP}/api \
VITE_POS_URL=https://pos.${EIP} \
VITE_PUBLIC_WEB_URL=https://www.${EIP} \
VITE_QR_ORDER_WEB_ORIGIN=https://order.${EIP} \
pnpm run build

# Build Public web client
cd ../../public-web/client
VITE_PUBLIC_WEB_API_URL=https://www.${EIP}/api \
VITE_ADMIN_URL=https://admin.${EIP} \
VITE_POS_URL=https://pos.${EIP} \
VITE_PUBLIC_WEB_URL=https://www.${EIP} \
VITE_QR_ORDER_WEB_ORIGIN=https://order.${EIP} \
pnpm run build

# Build QR order client
cd ../../qr-order/client
VITE_QR_ORDER_API_URL=https://order.${EIP}/api \
VITE_POS_URL=https://pos.${EIP} \
VITE_ADMIN_URL=https://admin.${EIP} \
VITE_PUBLIC_WEB_URL=https://www.${EIP} \
pnpm run build
```

## Verification

After deployment, verify the URLs are correct:

1. **QR Codes in POS**:
   - Go to POS → Café Tables & QR
   - Create a table
   - Check that the QR code URL starts with your `VITE_QR_ORDER_WEB_ORIGIN` (NOT the POS URL)

2. **Sign In Modal on Public Web**:
   - Visit your public website
   - Click "Sign In"
   - Verify "Admin portal" tile links to `VITE_ADMIN_URL`
   - Verify "POS" tile links to `VITE_POS_URL`

3. **Open POS from Admin Portal**:
   - Sign in to admin portal
   - Click "Open POS" in sidebar or dashboard
   - Should navigate to `VITE_POS_URL`

## Common Issues

### QR Codes Still Showing Old URL

**Problem**: QR codes in POS show old base URL  
**Solution**: Rebuild POS client with correct `VITE_QR_ORDER_WEB_ORIGIN` environment variable

### Sign-In Modal Links Not Working

**Problem**: Sign In modal on public web has broken or localhost links  
**Solution**: Rebuild public web client with correct `VITE_ADMIN_URL` and `VITE_POS_URL`

### "Open POS" in Admin Portal Goes to Wrong Place

**Problem**: Admin portal's "Open POS" link points to wrong URL  
**Solution**: Rebuild admin portal client with correct `VITE_POS_URL`

### Changes Not Taking Effect

**Problem**: Updated `deploy.env` but URLs still wrong  
**Solution**: Run `./scripts/deploy-production.sh` to rebuild all clients with new environment variables

## Technical Details

### Build-Time vs Runtime

**IMPORTANT**: `VITE_*` environment variables are **baked into the browser bundle** at build time. They cannot be changed at runtime without rebuilding.

- ✅ Set before `pnpm run build`
- ❌ Cannot be changed after build
- ❌ Setting them in PM2 or server environment has no effect on built clients

### Why Not Use Hardcoded URLs?

The `@innovapos/app-urls` package provides:
1. **Flexibility**: Different environments (dev, staging, prod) use different URLs
2. **DRY**: One source of truth for all cross-app links
3. **Type Safety**: Centralized functions prevent typos
4. **Dev Fallbacks**: Automatic localhost URLs in development

### Legacy Environment Variable Names

Some old variable names are still supported for backward compatibility:

- `VITE_ADMIN_PORTAL_URL` → Use `VITE_ADMIN_URL` instead
- `VITE_PUBLIC_ORDER_PAGE_ORIGIN` → Use `VITE_QR_ORDER_WEB_ORIGIN` instead

New code should use the new names.

## See Also

- [`docs/ENV_VARIABLES.md`](./ENV_VARIABLES.md) - Complete environment variable reference
- [`docs/EC2_PRODUCTION_DEPLOY.md`](./EC2_PRODUCTION_DEPLOY.md) - Production deployment guide
- [`packages/app-urls/src/browser.js`](../packages/app-urls/src/browser.js) - Cross-app URL implementation

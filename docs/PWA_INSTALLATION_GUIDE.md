# PWA Installation Guide

## Why You Might Not See the Install Prompt

The PWA install prompt will only show if **ALL** these requirements are met:

### ✅ Requirements

1. **HTTPS Required** (or localhost for development)
   - Production must use HTTPS
   - HTTP will NOT work for PWA installation
   - Check: Is your site accessible via `https://`?

2. **Not Already Installed**
   - If already installed, prompt won't show again
   - Check: Look for the app icon on your device
   - Uninstall first to see prompt again

3. **Service Worker Registered**
   - Check browser console for: ✅ ServiceWorker registered
   - If you see errors, service worker failed

4. **Valid Manifest**
   - manifest.json must be accessible
   - Check: Visit `https://yoursite.com/manifest.json`
   - Must return JSON, not 404

5. **User Engagement**
   - Chrome requires user to interact with site first
   - Must visit site at least once
   - Must spend a few seconds on the site

6. **Browser Support**
   - Chrome/Edge: Full support with install banner
   - Safari iOS: Manual install via Share → Add to Home Screen
   - Firefox: Manual install via menu

---

## How to Check PWA Readiness

### Step 1: Open Browser DevTools
Press `F12` or right-click → Inspect

### Step 2: Check Application Tab

**Chrome/Edge:**
1. Go to Application tab
2. Click "Manifest" in sidebar
3. Should show your app details
4. Check "Installability" section for errors

**Look for:**
- ✅ Manifest loaded successfully
- ✅ Service worker registered and activated
- ✅ Icons present
- ✅ No errors in Installability section

### Step 3: Check Console Logs

You should see:
```
✅ ServiceWorker registered: /
✅ PWA install prompt available
```

If you see:
```
❌ ServiceWorker registration failed
```
Then PWA won't work.

---

## Installation Methods by Browser

### 🖥️ Desktop Chrome/Edge
**Method 1: Install Icon**
- Look for ⊕ install icon in address bar (right side)
- Click it
- Click "Install"

**Method 2: Menu**
- Click ⋮ menu (three dots)
- Select "Install [App Name]..."
- Click "Install"

**Method 3: Settings**
- Settings → Apps → Install this site as an app

### 📱 Mobile Chrome (Android)
**Method 1: Banner**
- Install banner appears automatically
- Tap "Install" or "Add to Home screen"

**Method 2: Menu**
- Tap ⋮ menu (three dots)
- Tap "Install app" or "Add to Home screen"

### 📱 Safari (iOS/Mac)
**iOS:**
1. Tap Share button (square with arrow)
2. Scroll and tap "Add to Home Screen"
3. Edit name if desired
4. Tap "Add"

**Mac:**
1. Safari menu → File → Add to Dock
2. Or Share → Add to Dock

### 🦊 Firefox
1. Menu → Install
2. Or address bar → Install icon

---

## Debugging PWA Issues

### Issue: No Install Prompt Shows

**Check 1: HTTPS**
```bash
# Production must use HTTPS
curl -I https://yoursite.com
# Should return: HTTP/2 200 (not HTTP 301 redirect)
```

**Check 2: Service Worker**
```javascript
// In browser console:
navigator.serviceWorker.getRegistrations()
  .then(regs => console.log(regs.length + ' service workers'))
```

**Check 3: Manifest**
```bash
# Check manifest loads
curl https://yoursite.com/manifest.json
# Should return JSON, not HTML or 404
```

**Check 4: Already Installed**
- Check app drawer/home screen for app icon
- Try uninstalling first

### Issue: Service Worker Fails

**Possible causes:**
- Incorrect path to sw.js
- CORS issues
- Build tool not copying sw.js to dist
- Cache issues

**Fix:**
1. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Unregister old service workers:
```javascript
navigator.serviceWorker.getRegistrations()
  .then(regs => regs.forEach(reg => reg.unregister()))
```

### Issue: Manifest Not Found

**Check build output:**
```bash
# After build, these files must exist:
ls apps/pos/client/dist/manifest.json
ls apps/pos/client/dist/sw.js
ls apps/admin-portal/client/dist/manifest.json
ls apps/admin-portal/client/dist/sw.js
```

**If missing:**
- Ensure files are in `/public` folder
- Rebuild with `pnpm run build`
- Check Vite config copies public files

---

## Testing PWA Locally

### Development (localhost)
```bash
# PWA works on localhost even without HTTPS
pnpm run dev
# Visit: http://localhost:5173
```

### Production Build (local)
```bash
# Build first
cd apps/pos/client
pnpm run build

# Serve with HTTPS
npx serve -s dist -l 3000 --ssl-cert cert.pem --ssl-key key.pem
# Visit: https://localhost:3000
```

### Production Server
```bash
# After deploying
# Visit: https://your-domain.com

# Check browser console
# Should see: ✅ ServiceWorker registered
# Should see: ✅ PWA install prompt available (after interaction)
```

---

## PWA Installability Checklist

Use this checklist to verify your PWA is installable:

**Environment:**
- [ ] Using HTTPS (or localhost for testing)
- [ ] Not using HTTP in production
- [ ] No mixed content warnings

**Files Present:**
- [ ] `/manifest.json` accessible
- [ ] `/sw.js` accessible
- [ ] Icons in `/public` folder
  - [ ] pwa-icon-192.png (192x192)
  - [ ] pwa-icon-512.png (512x512)

**Service Worker:**
- [ ] Service worker registered successfully
- [ ] No errors in console
- [ ] Cache working properly

**Manifest Valid:**
- [ ] `name` field present
- [ ] `short_name` field present
- [ ] `start_url` set to "/"
- [ ] `display` set to "standalone"
- [ ] `icons` array with 192 and 512 sizes
- [ ] `theme_color` matches app design

**Browser:**
- [ ] Fresh browser session (or cleared cache)
- [ ] Not already installed
- [ ] User has interacted with site
- [ ] Browser supports PWA

**Testing:**
- [ ] Chrome DevTools → Application → Manifest shows no errors
- [ ] Chrome DevTools → Application → Service Workers shows active worker
- [ ] Lighthouse audit shows "Installable"
- [ ] Install prompt appears (or manual install works)

---

## Forcing Install Prompt (Development)

If developing and want to trigger prompt manually:

```javascript
// Add this to your app for testing
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

// Call this from console or button click
async function promptInstall() {
  if (!deferredPrompt) {
    console.log('Install prompt not available');
    return;
  }
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('Install outcome:', outcome);
  deferredPrompt = null;
}

// In console:
promptInstall();
```

---

## Common Issues & Solutions

### 1. "Already Installed"
**Solution:** Uninstall first
- Desktop: Right-click app → Uninstall
- Mobile: Long-press icon → Uninstall/Remove

### 2. "Service Worker Failed"
**Solution:**
```bash
# Clear everything
- DevTools → Application → Clear storage → Clear site data
- Hard refresh (Ctrl+Shift+R)
- Try again
```

### 3. "Mixed Content"
**Solution:** Ensure all resources load via HTTPS
```bash
# Check for http:// in:
- Images
- Scripts
- Stylesheets
- API calls
```

### 4. "Manifest Not Valid"
**Solution:** Validate manifest
- Visit: https://manifest-validator.appspot.com/
- Paste your manifest JSON
- Fix any errors

### 5. "Icons Not Loading"
**Solution:**
```bash
# Verify icons exist
ls -lh apps/pos/client/public/pwa-icon-*
# Should show 2 files

# Check in browser
https://yoursite.com/pwa-icon-192.png
https://yoursite.com/pwa-icon-512.png
# Should display images, not 404
```

---

## Testing with Lighthouse

Run Lighthouse audit for PWA:

1. Open DevTools (F12)
2. Click "Lighthouse" tab
3. Select "Progressive Web App"
4. Click "Generate report"

**Look for:**
- ✅ Installable (must be 100%)
- ✅ PWA Optimized
- ✅ Fast and reliable
- ✅ Works offline

**Fix issues shown** in the report.

---

## Browser-Specific Notes

### Chrome (Desktop & Android)
- Most reliable for PWA install prompts
- Shows install icon in address bar
- Supports beforeinstallprompt event
- Best developer tools

### Edge (Desktop & Mobile)
- Same as Chrome (Chromium-based)
- Excellent PWA support
- Can pin to taskbar (Windows)

### Safari (iOS & Mac)
- NO automatic install prompt
- Must use Share → Add to Home Screen
- Limited service worker capabilities
- No beforeinstallprompt event
- Still works, just manual install

### Firefox
- Good PWA support
- Install via menu
- Service workers work well

### Samsung Internet
- Excellent PWA support
- Supports ambient badging
- Install prompts work well

---

## Production Deployment

Ensure these in production:

1. **HTTPS Certificate**
   - Valid SSL/TLS certificate
   - Not self-signed in production
   - No certificate errors

2. **Server Config**
   - Serve manifest.json with correct MIME type: `application/manifest+json`
   - Serve sw.js with: `Content-Type: application/javascript`
   - Enable CORS if needed

3. **Cache Headers**
   - Service worker: `Cache-Control: no-cache`
   - Manifest: `Cache-Control: no-cache`
   - Static assets: long cache (1 year)

4. **Icons**
   - Both 192 and 512 versions present
   - Proper PNG format
   - Square dimensions
   - Clear, recognizable logo

---

## Next Steps

1. **Check browser console** for logs
2. **Verify all files** are built and deployed
3. **Test on HTTPS** (not HTTP)
4. **Try different browser** if one fails
5. **Check DevTools** Application tab for errors

**Remember:** Safari iOS requires manual installation - this is by design, not a bug!

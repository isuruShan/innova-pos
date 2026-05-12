# CORS hotfix on EC2 (when `/assets/*` returns 500)

Your stack traces show **old** server code:

- **POS:** `Error: CORS: origin http://…` at `apps/pos/server/src/index.js` inside an inline `cors({ origin: (origin, cb) => … })`.
- **Admin:** `Error: Not allowed` at `apps/admin-portal/server/src/index.js:45` — that line number matches the **old** `cb(new Error('Not allowed'))` pattern.

In the **fixed** repo, POS line ~51 is `createCorsMiddleware(…)` and admin line ~45 is `production: process.env.NODE_ENV === 'production'` (inside `createCorsMiddleware`), **not** a `cors` callback.

## Preferred fix (use your real repo / branch)

From the machine that has the fix (`createCorsMiddleware` + updated `@innovapos/shared-middleware`):

```bash
cd /home/ec2-user/Cafinity/innova-pos
git fetch origin && git status
git pull origin <your-branch-with-CORS-fix>
pnpm install
# restart PM2 / systemd / your process manager
```

Then on the server verify:

```bash
grep -n createCorsMiddleware apps/pos/server/src/index.js apps/admin-portal/server/src/index.js
grep -n originMatchesRequestHost packages/shared-middleware/src/corsMiddleware.js 2>/dev/null || true
```

Both greps should print lines. If the second file is missing, `pnpm install` did not link the workspace package — run install from the **monorepo root**.

---

## Hotfix without `createCorsMiddleware` (inline, copy-paste)

If you **cannot** pull yet, replace your **production** `app.use(cors({…}))` block with this pattern on **each** affected server (`pos`, `admin-portal`, `public-web`, `auth-service`, `upload-service`).

**1. After** `const allowedOrigins = …` add:

```javascript
function originMatchesRequestHost(req, origin) {
  const host = req.get('host');
  if (!host || !origin) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}
```

**2. Replace** the entire `app.use(cors({ … }))` (or `app.use(cors({origin:…}))`) with:

```javascript
const isProd = process.env.NODE_ENV === 'production';
app.use((req, res, next) =>
  require('cors')({
    origin: isProd
      ? (origin, cb) => {
          if (!origin) return cb(null, true);
          if (allowedOrigins.includes(origin)) return cb(null, true);
          if (originMatchesRequestHost(req, origin)) return cb(null, true);
          return cb(new Error('CORS: origin not allowed'));
        }
      : true,
    credentials: true,
  })(req, res, next),
);
```

Adjust `isProd` if you already use a different variable (e.g. `isProd` on POS).

**Why the wrapper `(req, res, next) => cors(…)(req,res,next)`:** the `cors` library’s `origin` callback does **not** receive `req`; the wrapper closes over `req` so we can compare `Origin` to the `Host` header.

---

## Still blocked? Set `CORS_ORIGIN` explicitly

Until code is fixed, set (no spaces after commas):

```text
CORS_ORIGIN=http://YOUR_IP:5000,http://YOUR_IP:5001,http://YOUR_IP:5002
```

Restart every Node process after changing env.

---

## After hotfix

Remove duplicate logic by syncing the repo version that uses **`createCorsMiddleware`** from `@innovapos/shared-middleware` so you only maintain CORS in one place.

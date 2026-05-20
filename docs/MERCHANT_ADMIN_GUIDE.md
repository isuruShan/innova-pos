# Merchant admin guide

The public marketing site hosts the interactive **Merchant guide** at `/merchant-guide` (source: `apps/public-web/client`).

## Structure

- **Index** — `/merchant-guide` lists all topics and the feature map table.
- **Topic pages** — `/merchant-guide/:slug` (one page per feature; content in `src/content/merchantGuide.js`).
- **Screenshots** — `public/guide/` (admin portal, POS, and website sign-in images).

## Local development

Admin portal analytics and dashboard API calls require the **admin API** on port **5001**:

```bash
# From repo root — admin server + client + other stack apps
pnpm dev

# Admin portal only (server + client)
pnpm admin
```

If only the Vite client is running, `/api/*` proxy requests return `502` with a message that the API is not running.

## Keeping content in sync

When adding admin or POS features, update `merchantGuide.js` and add screenshots under `apps/public-web/client/public/guide/` where helpful.

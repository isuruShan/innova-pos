#!/usr/bin/env bash
# Reinstall deps so Rolldown/Vite 8 native bindings match this machine (Linux VM, etc.).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Node $(node -v) | platform $(uname -s)-$(uname -m)"

if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi

echo "==> Removing node_modules (stale bindings from other OS are a common cause)"
rm -rf node_modules
find apps packages services -name node_modules -type d -prune -exec rm -rf {} + 2>/dev/null || true

echo "==> pnpm install (optional native bindings enabled via .npmrc)"
pnpm install

echo "==> Verifying @rolldown/binding-linux-x64-gnu on Linux x64"
if [[ "$(uname -s)" == "Linux" && "$(uname -m)" == "x86_64" ]]; then
  node -e "require('@rolldown/binding-linux-x64-gnu'); console.log('rolldown linux-x64-gnu OK')"
fi

echo "==> Done. Run: pnpm --filter @admin-portal/client dev   OR   ./scripts/deploy-production.sh"

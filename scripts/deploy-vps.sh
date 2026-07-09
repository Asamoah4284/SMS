#!/usr/bin/env bash
# Run on the VPS from the repo root: bash scripts/deploy-vps.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Pull latest (deacons)"
git pull origin deacons

echo "==> Backend: install, migrate, restart"
cd "$ROOT/backend"
npm install
npm run db:migrate:deploy
pm2 restart sms-backend --update-env

echo "==> Optional: sync guardian phones → parent accounts (safe to re-run)"
echo "    npm run parents:sync-guardians"

echo "==> Frontend: install, BUILD, restart"
cd "$ROOT/frontend"
npm install
npm run build
pm2 restart sms-frontend --update-env

echo "==> Done. Hard-refresh the browser (Ctrl+Shift+R)."

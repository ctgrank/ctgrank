#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Redeploy Shikhor to Surge.
#   ./deploy.sh                       → https://shikhor-ctg.surge.sh
#   ./deploy.sh my-other.surge.sh     → a different subdomain
#   ./deploy.sh mydomain.com          → a custom domain you own
# Non-interactive once ~/.netrc holds the surge credentials (already true
# in this sandbox). Otherwise it will prompt for the account email/password.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="${1:-shikhor-ctg.surge.sh}"
CLI_DIR="/home/user/surge-cli"
CLI="$CLI_DIR/node_modules/.bin/surge"

if [ ! -x "$CLI" ]; then
  echo "→ installing surge CLI…"
  mkdir -p "$CLI_DIR"
  ( cd "$CLI_DIR" && npm init -y >/dev/null 2>&1 && npm install surge ) >/dev/null
fi

echo "→ publishing to https://$DOMAIN"
"$CLI" --project . --domain "$DOMAIN"

# surge drops a CNAME file in the project root; it would break GitHub Pages.
rm -f CNAME

echo "✓ live at https://$DOMAIN"

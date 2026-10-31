#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Redeploy Shikhor to Surge.
#   ./deploy.sh                       → https://shikhor.surge.sh
#   ./deploy.sh my-other.surge.sh     → a different subdomain
#   ./deploy.sh mydomain.com          → a custom domain you own
# Non-interactive once ~/.netrc holds the surge credentials (already true
# in this sandbox). Otherwise it will prompt for the account email/password.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="${1:-shikhor.surge.sh}"
CLI_DIR="/home/user/surge-cli"
CLI="$CLI_DIR/node_modules/.bin/surge"

if [ ! -x "$CLI" ]; then
  echo "→ installing surge CLI…"
  mkdir -p "$CLI_DIR"
  ( cd "$CLI_DIR" && npm init -y >/dev/null 2>&1 && npm install surge ) >/dev/null
fi

# Bump the asset cache-buster so no browser ever serves a stale app.js/styles.css.
# Without this, a returning visitor can keep running the old bundle (and so keep
# seeing the old default exam) even though the deploy succeeded.
V=$(date +%s)
sed -i -E "s|(assets/styles\.css)\?v=[0-9]+|\1?v=$V|; s|(assets/app\.js)\?v=[0-9]+|\1?v=$V|" index.html
echo "→ cache-buster v=$V"

echo "→ publishing to https://$DOMAIN"
"$CLI" --project . --domain "$DOMAIN"

# surge drops a CNAME file in the project root; it would break GitHub Pages.
rm -f CNAME

echo "✓ live at https://$DOMAIN"

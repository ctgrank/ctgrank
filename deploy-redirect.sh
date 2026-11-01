#!/usr/bin/env bash
# Point the old Surge domains at the new home.
#
#   ./deploy-redirect.sh
#
# Publishes tools/redirect-site/ (a redirect stub, no rank data) to every
# Surge domain. The real site lives at https://ctgrank.pages.dev.
set -euo pipefail
cd "$(dirname "$0")"

SITE="tools/redirect-site"
DOMAINS=("shikhor.surge.sh" "ctgrank.surge.sh")

for d in "${DOMAINS[@]}"; do
  echo "════════ $d ════════"
  /home/user/surge-cli/node_modules/.bin/surge --project "$SITE" --domain "$d"
done
echo
echo "Both Surge domains now redirect to https://ctgrank.pages.dev"

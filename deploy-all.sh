#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Publish Shikhor to every host at once.
#
#   ./deploy-all.sh
#
# Surge domains are published from this folder; GitHub Pages is served by
# pushing the branch. Each Surge publish stamps a fresh ?v= cache-buster on
# the assets, so they finish a few seconds apart with different version
# strings — the file contents are identical, only the query string differs.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

DOMAINS=(shikhor.surge.sh ctgrank.surge.sh)

for d in "${DOMAINS[@]}"; do
  echo ""
  echo "════════ $d ════════"
  ./deploy.sh "$d" 2>&1 | grep -E "cache-buster|Success|Aborted|Error" || true
done

# surge drops a CNAME in the project root; it would break GitHub Pages
rm -f CNAME

cat <<'EOF'

════════ done ════════
Surge:
  https://shikhor.surge.sh
  https://ctgrank.surge.sh

GitHub Pages (https://ctgrank.github.io) is served by pushing:
  git add -A && git commit -m "…" && git push
EOF

#!/usr/bin/env bash
# Étape 2 — APRÈS avoir renommé le dépôt dans GitHub (Settings → Repository name).
# Met à jour origin sur cette machine pour le nouveau nom.
# Usage :
#   ./scripts/02-apres-renommage-github.sh NOUVEAU_NOM_REPO
# Exemple (si le repo devient https://github.com/danield8877/amen-revamperr) :
#   ./scripts/02-apres-renommage-github.sh amen-revamperr
set -euo pipefail
NEW_NAME="${1:-}"
GITHUB_USER="${GITHUB_USER:-danield8877}"
if [[ -z "$NEW_NAME" ]]; then
  echo "Usage: $0 <nouveau_nom_du_depot_sans_user>"
  echo "Exemple: $0 amen-revamperr"
  exit 1
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
NEW_URL="https://github.com/${GITHUB_USER}/${NEW_NAME}.git"
echo ">>> origin → ${NEW_URL}"
git remote set-url origin "$NEW_URL"
git remote -v
echo ">>> Pense à mettre à jour l’URL du dépôt dans Coolify (Source) avec la même URL."
echo ">>> Sur ton PC : git remote set-url origin <même URL> puis git fetch && git reset --hard origin/main"

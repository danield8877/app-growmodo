#!/usr/bin/env bash
# Étape 1 — Pousser le main du serveur vers GitHub (historique actuel, force si besoin).
# Usage :
#   export GITHUB_TOKEN='ghp_xxxxxxxx'   # PAT : scope "repo"
#   ./scripts/01-push-serveur-vers-github.sh
# Optionnel : slug du dépôt (défaut danield8877/app-growmodo)
set -euo pipefail
REPO_SLUG="${1:-danield8877/app-growmodo}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "ERREUR : définis GITHUB_TOKEN (Personal Access Token GitHub, scope repo)."
  echo "  export GITHUB_TOKEN='ghp_...'"
  echo "  $0"
  exit 1
fi

echo ">>> Push vers https://github.com/${REPO_SLUG}.git (branche main)..."
# URL avec token : ne pas committer ce token ailleurs ; ne pas le logger.
git push "https://${GITHUB_TOKEN}@github.com/${REPO_SLUG}.git" main --force
echo ">>> OK — GitHub est aligné avec ce serveur."

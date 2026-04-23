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

# PAT classic (ghp_…) ou fine-grained (github_pat_…) — pas le mot de passe du compte GitHub.
if [[ ! "$GITHUB_TOKEN" =~ ^(ghp_|github_pat_) ]]; then
  echo "ATTENTION : le token devrait commencer par ghp_ (classic) ou github_pat_ (fine-grained)."
fi

echo ">>> Push vers https://github.com/${REPO_SLUG}.git (branche main)..."
# Désactiver credential.helper pour CE push : sinon un ancien mot de passe / mauvais token en cache
# remplace l’URL et GitHub répond « Invalid username or token » même avec un bon PAT.
# Ne pas committer le token ; ne pas le logger.
GIT_TERMINAL_PROMPT=0 git -c credential.helper= \
  push "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO_SLUG}.git" main --force
echo ">>> OK — GitHub est aligné avec ce serveur."

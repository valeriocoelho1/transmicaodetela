#!/usr/bin/env bash
# Rebuilds the stack when CI has moved the production branch. Run by the systemd timer.
set -euo pipefail

# Wrapped in a function so bash reads it whole before git rewrites this file.
main() {
  cd "$(dirname "$0")/.."
  git fetch --quiet origin production
  if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/production)" ]; then
    return
  fi
  git merge --ff-only --quiet origin/production
  echo "Deploying $(git rev-parse --short HEAD)"
  docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
  docker image prune -f
}

main "$@"

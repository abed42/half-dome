#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: halfdome/scripts/sync-ardia.sh <ardia-tag>

Rebase the halfdome branch onto an Ardia release tag from upstream.

Example:
  halfdome/scripts/sync-ardia.sh v0.2.48

Options:
  --help   Show this help
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  usage >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if ! git remote get-url upstream >/dev/null 2>&1; then
  git remote add upstream https://github.com/ardia-browser/ardia.git
fi

git fetch upstream --tags --force
git fetch origin --tags --force 2>/dev/null || true

if ! git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "tag not found after fetch: $TAG" >&2
  exit 1
fi

branch="$(git branch --show-current)"
if [[ "$branch" != "halfdome" ]]; then
  git checkout halfdome
fi

echo "Rebasing halfdome onto $TAG ($(git rev-parse --short "$TAG"))"
if ! git rebase "$TAG"; then
  echo "Rebase stopped on conflicts. Fix them, then: git rebase --continue" >&2
  echo "Abort with: git rebase --abort" >&2
  exit 1
fi

echo "OK: halfdome is on top of $TAG"
echo "Push with: git push --force-with-lease origin halfdome"

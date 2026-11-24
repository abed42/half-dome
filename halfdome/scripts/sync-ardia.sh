#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: halfdome/scripts/sync-ardia.sh <ardia-tag>

Merge an Ardia release tag into a sync/ardia-<tag> branch based on halfdome,
ready to open as a PR into halfdome.

Example:
  halfdome/scripts/sync-ardia.sh v0.2.48

Skips when halfdome already contains the tag, or when sync/ardia-<tag>
already holds it.

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
git fetch origin halfdome 2>/dev/null || true

if ! git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "tag not found after fetch: $TAG" >&2
  exit 1
fi

BRANCH="sync/ardia-$TAG"
HALFDOME_REF="halfdome"
if git rev-parse -q --verify "refs/remotes/origin/halfdome" >/dev/null; then
  HALFDOME_REF="origin/halfdome"
elif ! git rev-parse -q --verify "refs/heads/halfdome" >/dev/null; then
  echo "halfdome branch not found locally or on origin" >&2
  exit 1
fi

if git merge-base --is-ancestor "$TAG" "$HALFDOME_REF"; then
  echo "halfdome already contains $TAG; nothing to do"
  exit 0
fi

git fetch origin "$BRANCH" 2>/dev/null || true
SYNC_REF=""
if git rev-parse -q --verify "refs/remotes/origin/$BRANCH" >/dev/null; then
  SYNC_REF="origin/$BRANCH"
elif git rev-parse -q --verify "refs/heads/$BRANCH" >/dev/null; then
  SYNC_REF="$BRANCH"
fi
if [[ -n "$SYNC_REF" ]] && git merge-base --is-ancestor "$TAG" "$SYNC_REF"; then
  echo "sync branch $BRANCH already holds $TAG; nothing to do"
  exit 0
fi

git checkout -B "$BRANCH" "$HALFDOME_REF"

echo "Merging $TAG ($(git rev-parse --short "$TAG")) into $BRANCH"
if ! git merge --no-ff -m "Merge Ardia $TAG into halfdome" "$TAG"; then
  echo "Merge stopped on conflicts. Fix them, then: git commit" >&2
  echo "Abort with: git merge --abort" >&2
  exit 1
fi

echo "OK: $BRANCH merges $TAG"
echo "Push with: git push -u origin $BRANCH"
echo "Open PR: gh pr create --base halfdome --head $BRANCH --title \"Sync Ardia $TAG\""

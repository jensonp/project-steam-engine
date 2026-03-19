#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/Users/jensonphan/cs125"
ORIGIN_REMOTE="origin"
UPSTREAM_REMOTE="upstream"
BRANCH="main"
PUSH_ORIGIN=0

usage() {
  cat <<'EOF'
Usage: sync-main-to-cherryquartzio.sh [--push-origin]

Sync local main to CherryQuartzio/main (upstream):
1) Verify clean working tree
2) Fetch origin/main and upstream/main
3) Merge upstream/main into local main (if needed)
4) Push local main to upstream/main

Optional:
  --push-origin   Also push local main to origin/main
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --push-origin)
      PUSH_ORIGIN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

cd "$REPO_ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit/stash changes before syncing." >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "$BRANCH" ]]; then
  echo "Current branch is '$current_branch'. Switch to '$BRANCH' first." >&2
  exit 1
fi

echo "Fetching remotes..."
git fetch "$ORIGIN_REMOTE" "$BRANCH"
git fetch "$UPSTREAM_REMOTE" "$BRANCH"

echo "Merging $UPSTREAM_REMOTE/$BRANCH into local $BRANCH..."
git merge --no-edit "$UPSTREAM_REMOTE/$BRANCH"

if [[ "$PUSH_ORIGIN" -eq 1 ]]; then
  echo "Pushing to $ORIGIN_REMOTE/$BRANCH..."
  git push "$ORIGIN_REMOTE" "$BRANCH"
fi

echo "Pushing to $UPSTREAM_REMOTE/$BRANCH..."
git push "$UPSTREAM_REMOTE" "$BRANCH"

echo "Done. Local $BRANCH is synced to $UPSTREAM_REMOTE/$BRANCH."

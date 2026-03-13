#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="/Users/tranminhtue/Downloads/cafair"
TARGET_BRANCH="apply-agent-tue"
MAIN_BRANCH="main"

cd "$REPO_ROOT"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is not clean."
  echo "Commit or stash your changes before running this script."
  exit 1
fi

echo "Fetching latest remote branches..."
git fetch origin

echo "Switching to $MAIN_BRANCH..."
git switch "$MAIN_BRANCH"

echo "Pulling latest changes from origin/$MAIN_BRANCH..."
git pull --ff-only origin "$MAIN_BRANCH"

echo "Switching back to $TARGET_BRANCH..."
git switch "$TARGET_BRANCH"

echo "Merging $MAIN_BRANCH into $TARGET_BRANCH..."
git merge --no-edit "$MAIN_BRANCH"

echo
echo "Update complete."
echo "Review the merge, then push with:"
echo "git push origin $TARGET_BRANCH"

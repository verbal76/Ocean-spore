#!/usr/bin/env bash
# A build number identifies exactly one coordinated release (studio standard sec. 6/8).
# Fails before any expensive step if the requested number is not the one committed at
# this SHA, or if a tag / GitHub Release for it already exists (immutable releases).
# Env: REQUESTED_BUILD (optional), GH_TOKEN + REPO (to check GitHub Releases; optional locally).
set -euo pipefail
cd "$(dirname "$0")/.."
V=$(node scripts/version.js version-name)
if [ -n "${REQUESTED_BUILD:-}" ] && [ "$REQUESTED_BUILD" != "$V" ]; then
  echo "::error::build_number $REQUESTED_BUILD != oceanSpore.build $V committed at this SHA"; exit 1
fi
python3 scripts/check-version-unused.py "$V"
if [ -n "${GH_TOKEN:-}" ] && [ -n "${REPO:-}" ]; then
  T=$(node scripts/version.js release-tag)
  for tag in "$T" "v$V"; do
    if gh api "repos/$REPO/releases/tags/$tag" > /dev/null 2>&1; then
      echo "::error::A GitHub Release $tag already exists. Bump oceanSpore.build."; exit 1
    fi
  done
fi
echo "build $V is valid and unused"

#!/bin/sh
# Launches Ocean Spore on Linux (Steam Deck / Steam Machine / desktop).
#
# The Chromium sandbox stays ON wherever the system can provide it. Chromium needs
# either a setuid chrome-sandbox helper or unprivileged user namespaces; we never ship
# the helper setuid (it would need root at install time), so the namespace sandbox is
# what normally runs. It is unavailable (a) when running as root, (b) inside containers
# that forbid nested user namespaces (e.g. some Steam Linux Runtime / Flatpak setups),
# (c) on kernels with unprivileged user namespaces disabled. Only then does this script
# fall back to --no-sandbox, and it says so. The renderer only ever loads this app's own
# bundled files (no remote content), which limits what the fallback exposes.
#
# Environment:
#   OCEAN_SPORE_SANDBOX=required   never fall back; exit with an error instead
#   OCEAN_SPORE_NO_SANDBOX=1       explicit opt-out (support / debugging)
#   OCEAN_SPORE_DRY_RUN=1          print the decision and the command, do not start
HERE="$(dirname "$(readlink -f "$0")")"
REASON=""

if [ "${OCEAN_SPORE_NO_SANDBOX:-}" = "1" ]; then
  REASON="OCEAN_SPORE_NO_SANDBOX=1 was set"
elif [ "$(id -u)" = "0" ]; then
  REASON="running as root (Chromium refuses its sandbox as root)"
elif [ -u "$HERE/chrome-sandbox" ]; then
  REASON=""                                   # setuid helper present: sandbox works
elif command -v unshare >/dev/null 2>&1 && ! unshare -U true >/dev/null 2>&1; then
  REASON="unprivileged user namespaces are not available here"
fi

if [ -n "$REASON" ]; then
  if [ "${OCEAN_SPORE_SANDBOX:-}" = "required" ]; then
    echo "Ocean Spore: the Chromium sandbox is required but unavailable: $REASON" >&2
    exit 78
  fi
  echo "Ocean Spore: starting WITHOUT the Chromium sandbox: $REASON" >&2
  set -- --no-sandbox "$@"
  DECISION="no-sandbox"
else
  DECISION="sandbox"
fi

if [ "${OCEAN_SPORE_DRY_RUN:-}" = "1" ]; then
  echo "decision=$DECISION"
  echo "exec=$HERE/OceanSpore $*"
  exit 0
fi
exec "$HERE/OceanSpore" "$@"

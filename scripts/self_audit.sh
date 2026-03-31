#!/usr/bin/env bash
set -euo pipefail

# Self-audit: check git status; alert if working tree dirty
# Requires ALERT_PHONE env var for iMessage; falls back to echo if not set.

REPO_DIR="/Users/sashabirukoff/Desktop/SB/12 Projects/wario-dashboard"

cd "$REPO_DIR"
if ! git status --porcelain > /dev/null 2>&1; then
  echo "Not a git repo or git not available"
  exit 1
fi

if git status --porcelain | read -r; then
  # There are uncommitted changes
  MSG="⚠️ Wario Dashboard: working tree dirty in $REPO_DIR"
  if [[ -n "${ALERT_PHONE:-}" ]]; then
    bash "$(dirname "$0")/send_alert.sh" "$MSG" &
  else
    echo "$MSG"
  fi
else
  echo "✅ Self-audit: working tree clean"
fi

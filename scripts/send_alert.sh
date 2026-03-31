#!/usr/bin/env bash
set -euo pipefail

MESSAGE="${1:-Wario Dashboard alert}"
# Default to your phone if ALERT_PHONE env is set; otherwise you must pass number as arg
PHONE="${ALERT_PHONE:-${1}}"

if [[ -z "$PHONE" ]]; then
  echo "Usage: ALERT_PHONE=<number> scripts/send_alert.sh \"message\""
  exit 1
fi

# AppleScript to send iMessage via Messages app
osascript <<EOF
tell application "Messages"
  activate
  set targetService to 1st service whose service type = iMessage
  set targetBuddy to buddy "$PHONE" of targetService
  send "$MESSAGE" to targetBuddy
end tell
EOF

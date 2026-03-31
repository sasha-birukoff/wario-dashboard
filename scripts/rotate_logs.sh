#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${HOME}/.openclaw/workspace/dispatch/logs"
DRY_RUN=0
VERBOSE=1

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=1 ;;
    -v|--verbose) VERBOSE=1 ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

mkdir -p "$LOG_DIR"

# Log function
log() {
  if [[ $VERBOSE -eq 1 ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  fi
}

# Find logs older than 30 days and compress them
log "Scanning $LOG_DIR for log files to rotate..."
find "$LOG_DIR" -type f -name "*.log" -mtime +30 | while read -r file; do
  gz="${file}.gz"
  if [[ $DRY_RUN -eq 1 ]]; then
    log "[DRY] Would compress: $file -> $gz"
  else
    log "Compressing: $file -> $gz"
    gzip -c "$file" > "$gz" && rm -f "$file"
  fi
done

# Delete compressed archives older than 90 days
log "Pruning old archives..."
find "$LOG_DIR" -type f -name "*.log.gz" -mtime +90 | while read -r gz; do
  if [[ $DRY_RUN -eq 1 ]]; then
    log "[DRY] Would delete: $gz"
  else
    log "Deleting: $gz"
    rm -f "$gz"
  fi
done

log "Log rotation complete."

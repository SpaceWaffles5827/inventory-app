#!/usr/bin/env bash
# Install (or remove) the nightly inventory-app backup as a cron job for the
# current user. Idempotent — re-running just updates the single entry.
#
#   bash scripts/backup-cron.install.sh               # nightly at 03:30
#   BACKUP_CRON='0 */12 * * *' bash scripts/backup-cron.install.sh   # custom
#   bash scripts/backup-cron.install.sh --uninstall
#
# After installing, confirm with:  crontab -l

set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Default: 03:30 every day (low-traffic hour; one snapshot/day = at most ~24h
# of data loss). Override with BACKUP_CRON (standard 5-field cron spec).
SCHED="${BACKUP_CRON:-30 3 * * *}"
TAG="# inventory-app-backup"
LINE="$SCHED cd \"$REPO\" && bash scripts/backup.sh >> \"$REPO/backups/cron.log\" 2>&1 $TAG"

command -v crontab >/dev/null 2>&1 || {
  echo "crontab not found. Install cron first:  sudo apt-get install -y cron" >&2
  exit 1
}

current="$(crontab -l 2>/dev/null || true)"
filtered="$(printf '%s\n' "$current" | grep -vF "$TAG" || true)"

if [ "${1:-}" = "--uninstall" ]; then
  printf '%s\n' "$filtered" | sed '/^[[:space:]]*$/d' | crontab -
  echo "Removed the inventory-app backup cron job."
  exit 0
fi

printf '%s\n%s\n' "$filtered" "$LINE" | sed '/^[[:space:]]*$/d' | crontab -
echo "Installed nightly backup cron job:"
echo "  $LINE"
echo
echo "Current crontab:"
crontab -l

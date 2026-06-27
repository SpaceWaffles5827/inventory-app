#!/usr/bin/env bash
# Shared config + helpers for the inventory-app backup / restore scripts.
# This file is SOURCED by backup.sh and restore.sh — it is not run directly.
#
# Override any setting via the environment or a gitignored scripts/backup.env
# (see scripts/backup.env.example). The one setting that usually matters is DC
# (the compose invocation) — it defaults to the PROD stack.

set -euo pipefail

# Repo root (this file lives in scripts/).
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Optional local overrides (gitignored). Lets you set DC / BACKUP_DIR / etc.
# without editing the scripts. See scripts/backup.env.example.
if [ -f "$REPO/scripts/backup.env" ]; then
  # shellcheck disable=SC1091
  . "$REPO/scripts/backup.env"
fi

# ── Config (env-overridable) ────────────────────────────────────────────────

# How to invoke docker compose. Defaults to the PRODUCTION stack (project
# inventory-prod, docker-compose.yml, .env). For the local DEV stack, override
# in scripts/backup.env:
#   DC="docker compose -p inventory-app-dev -f docker-compose.dev.yml --env-file .dev.env"
DC="${DC:-docker compose -p inventory-prod -f docker-compose.yml --env-file .env}"

# Where backups are written; each run gets its own timestamped subfolder.
# NB: defaults to the repo's backups/ — i.e. the SAME disk as the app. That is
# fine for "oops I deleted a row", but for real disaster recovery point this at
# a separate disk/mount and/or set OFFSITE_CMD (see below).
BACKUP_DIR="${BACKUP_DIR:-$REPO/backups}"

# Retention / rollover so storage stays bounded:
#   * always keep the newest MIN_KEEP runs (so you never lose recent snapshots,
#     even if backups silently stopped running), and
#   * among the older ones, delete anything past RETENTION_DAYS.
RETENTION_DAYS="${RETENTION_DAYS:-14}"
MIN_KEEP="${MIN_KEEP:-7}"

# Compose service names of the stateful stores + the app containers to pause
# during a restore.
MYSQL_SERVICE="${MYSQL_SERVICE:-mysql}"
MINIO_SERVICE="${MINIO_SERVICE:-minio}"
WEB_SERVICES="${WEB_SERVICES:-app server}"

# Tiny throwaway image used to read/write the MinIO data volume.
HELPER_IMAGE="${HELPER_IMAGE:-alpine:3.20}"

# Optional command run after a SUCCESSFUL backup, with the new backup dir as $1.
# Use it to push a copy off the server (the part that actually saves you):
#   OFFSITE_CMD='rsync -a "$1" backups@nas:/inventory-app/'
#   OFFSITE_CMD='rclone copy "$1" r2:inventory-app-backups/$(basename "$1")'
OFFSITE_CMD="${OFFSITE_CMD:-}"

# ── Helpers ─────────────────────────────────────────────────────────────────

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() { printf '%s  ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2; exit 1; }

# Run the configured compose command from the repo root. $DC is intentionally
# word-split so a multi-word value ("docker compose -p … -f …") works.
dc() { # shellcheck disable=SC2086
  ( cd "$REPO" && $DC "$@" )
}

# Container id of a RUNNING compose service, or empty.
cid_of() { dc ps -q "$1" 2>/dev/null | head -n1; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"; }

# Delete old backup folders: keep the newest MIN_KEEP always; of the rest,
# remove any older than RETENTION_DAYS. Backup folders are named YYYY-MM-DD_*.
prune_old_backups() {
  local dirs count prunable i
  mapfile -t dirs < <(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort)
  count=${#dirs[@]}
  if (( count <= MIN_KEEP )); then
    log "retention: $count backup(s) <= MIN_KEEP=$MIN_KEEP — keeping all"
    return 0
  fi
  prunable=$(( count - MIN_KEEP ))
  i=0
  for d in "${dirs[@]}"; do
    (( i < prunable )) || break
    i=$(( i + 1 ))
    if [ -n "$(find "$d" -maxdepth 0 -mtime +"$RETENTION_DAYS" 2>/dev/null)" ]; then
      rm -rf "$d" && log "retention: pruned $(basename "$d") (older than ${RETENTION_DAYS}d)"
    fi
  done
}

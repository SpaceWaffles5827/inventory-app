#!/usr/bin/env bash
# Back up every stateful inventory-app service into one timestamped folder:
#   - MySQL database     -> db.sql.gz    (mysqldump, gzip-compressed)
#   - MinIO object store -> minio.tar.gz (uploaded item images)
# Writes a MANIFEST.txt (checksums) and prunes backups past the retention window.
#
#   bash scripts/backup.sh
#
# Redis is a cache / session store (regenerates on demand) and is intentionally
# NOT backed up.
#
# Config + dev/prod overrides: see scripts/backup-common.sh / backup.env.example.

set -euo pipefail
# shellcheck source=scripts/backup-common.sh
. "$(dirname "${BASH_SOURCE[0]}")/backup-common.sh"

# Only docker is needed on the host: mysqldump runs inside the mysql container,
# tar runs inside the MinIO helper container.
require_cmd docker

mkdir -p "$BACKUP_DIR"

# Single-run lock so an overlapping cron tick can't corrupt a backup.
if command -v flock >/dev/null 2>&1; then
  exec 9>"$BACKUP_DIR/.lock"
  flock -n 9 || die "another backup is already running"
fi

STAMP="$(date +%F_%H%M%S)"
DEST="$BACKUP_DIR/$STAMP"
mkdir -p "$DEST"

# Tee all output to a per-run log AND the rolling backup.log.
exec > >(tee -a "$DEST/backup.log" "$BACKUP_DIR/backup.log") 2>&1
trap 'die "backup FAILED — see $DEST/backup.log (partial files left for inspection)"' ERR

log "=== backup $STAMP starting (DC='$DC') ==="

# 1) MySQL -------------------------------------------------------------------
MYSQL_CID="$(cid_of "$MYSQL_SERVICE")"
[ -n "$MYSQL_CID" ] || die "mysql service '$MYSQL_SERVICE' is not running"
log "dumping mysql database ..."
# Credentials are read from the container's own env (MYSQL_USER / MYSQL_PASSWORD
# / MYSQL_DATABASE), so this works for dev and prod without hardcoding anything.
# We connect over the service network ('-h mysql') as the app user, which holds
# ALL privileges on the application database — the same account the app uses.
# (A local/socket connection inside the container matches root@localhost, whose
# password can drift from the env if MYSQL_ROOT_PASSWORD changed post-init.)
# MYSQL_PWD avoids the "password on the command line" warning.
dc exec -T "$MYSQL_SERVICE" sh -c \
  'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysqldump -h mysql --single-transaction --quick --routines --events --triggers --no-tablespaces --set-gtid-purged=OFF -u "$MYSQL_USER" "$MYSQL_DATABASE"' \
  | gzip > "$DEST/db.sql.gz"
[ -s "$DEST/db.sql.gz" ] || die "db.sql.gz is empty — dump did not produce output"
if gzip -t "$DEST/db.sql.gz" 2>/dev/null; then
  log "  database OK ($(du -h "$DEST/db.sql.gz" | cut -f1))"
else
  die "db.sql.gz failed gzip integrity check"
fi

# 2) MinIO object store ------------------------------------------------------
MINIO_CID="$(cid_of "$MINIO_SERVICE")"
if [ -n "$MINIO_CID" ]; then
  log "archiving MinIO object store ..."
  # MSYS_NO_PATHCONV stops Git-Bash-on-Windows from rewriting the container
  # paths (/backup, /data) into Windows paths; it's a no-op on Linux.
  MSYS_NO_PATHCONV=1 docker run --rm --volumes-from "$MINIO_CID" -v "$DEST:/backup" "$HELPER_IMAGE" \
    tar czf /backup/minio.tar.gz -C /data .
  log "  MinIO OK ($(du -h "$DEST/minio.tar.gz" | cut -f1))"
else
  log "  WARNING: MinIO service '$MINIO_SERVICE' not running — skipping object store"
fi

# 3) Manifest + checksums ----------------------------------------------------
{
  echo "timestamp:  $STAMP"
  echo "host:       $(hostname)"
  echo "git:        $(cd "$REPO" && git rev-parse --short HEAD 2>/dev/null || echo n/a)"
  echo "compose:    $DC"
  echo "sha256:"
} > "$DEST/MANIFEST.txt"
( cd "$DEST" && sha256sum db.sql.gz minio.tar.gz 2>/dev/null ) >> "$DEST/MANIFEST.txt" || true

# Refresh the "latest" pointer (best-effort; some filesystems disallow symlinks).
ln -sfn "$STAMP" "$BACKUP_DIR/latest" 2>/dev/null || true

log "backup complete -> $DEST ($(du -sh "$DEST" | cut -f1))"

# 4) Retention / rollover ----------------------------------------------------
prune_old_backups

# 5) Optional off-site copy --------------------------------------------------
if [ -n "$OFFSITE_CMD" ]; then
  log "running off-site copy ..."
  if ( set -- "$DEST"; eval "$OFFSITE_CMD" ); then
    log "  off-site copy OK"
  else
    log "  WARNING: off-site copy command failed (backup is still on this server)"
  fi
fi

trap - ERR
log "=== backup $STAMP done ==="

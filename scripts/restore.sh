#!/usr/bin/env bash
# Restore inventory-app state from a backup made by scripts/backup.sh.
#
#   bash scripts/restore.sh                       # restore EVERYTHING from the newest backup
#   bash scripts/restore.sh 2026-06-27_033001     # a specific backup folder
#   bash scripts/restore.sh latest --db           # only the database, newest backup
#
# Flags:
#   --db | --minio    restore only these (default: all present in the backup)
#   --yes, -y         skip the "type RESTORE" confirmation
#   --no-stop         don't stop the app/server containers during restore
#
# DESTRUCTIVE: overwrites the live database and object store.

set -euo pipefail
# shellcheck source=scripts/backup-common.sh
. "$(dirname "${BASH_SOURCE[0]}")/backup-common.sh"

require_cmd docker

TARGET=""
DO_DB=0; DO_MINIO=0; ASSUME_YES=0; STOP_WEB=1
while [ $# -gt 0 ]; do
  case "$1" in
    --db)          DO_DB=1 ;;
    --minio)       DO_MINIO=1 ;;
    --yes|-y)      ASSUME_YES=1 ;;
    --no-stop)     STOP_WEB=0 ;;
    -*)            die "unknown flag: $1" ;;
    *)             TARGET="$1" ;;
  esac
  shift
done
# No component flags → restore all of them.
if [ $((DO_DB + DO_MINIO)) -eq 0 ]; then DO_DB=1; DO_MINIO=1; fi

# Resolve the backup folder (newest if none/"latest" given).
if [ -z "$TARGET" ] || [ "$TARGET" = "latest" ]; then
  DIR="$(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort | tail -1)"
  [ -n "$DIR" ] || die "no backups found in $BACKUP_DIR"
else
  DIR="$BACKUP_DIR/${TARGET%/}"
fi
[ -d "$DIR" ] || die "backup not found: $DIR"

# Downgrade requested components that aren't present in this backup.
log "Restore source: $DIR"
if [ "$DO_DB" -eq 1 ]; then
  if [ -f "$DIR/db.sql.gz" ]; then log "  will restore: database"; else log "  database: no db.sql.gz in backup — skipping"; DO_DB=0; fi
fi
if [ "$DO_MINIO" -eq 1 ]; then
  if [ -f "$DIR/minio.tar.gz" ]; then log "  will restore: MinIO object store"; else log "  MinIO: no minio.tar.gz — skipping"; DO_MINIO=0; fi
fi
[ $((DO_DB + DO_MINIO)) -gt 0 ] || die "nothing to restore from $DIR"

if [ "$ASSUME_YES" -ne 1 ]; then
  printf '\nThis OVERWRITES live data. Type RESTORE to proceed: '
  read -r ans
  [ "$ans" = "RESTORE" ] || die "aborted"
fi

# Stop the app/server so they aren't reading/writing mid-restore (best-effort).
if [ "$STOP_WEB" -eq 1 ]; then
  log "stopping app services ($WEB_SERVICES) ..."
  for s in $WEB_SERVICES; do dc stop "$s" >/dev/null 2>&1 || true; done
fi

# 1) Database ----------------------------------------------------------------
if [ "$DO_DB" -eq 1 ]; then
  MYSQL_CID="$(cid_of "$MYSQL_SERVICE")"
  [ -n "$MYSQL_CID" ] || die "mysql service '$MYSQL_SERVICE' is not running"
  log "restoring database ..."
  # The dump (mysqldump default) drops+recreates each table and disables
  # FOREIGN_KEY_CHECKS for the load, so importing over the live DB is safe.
  # Same connection style as backup.sh: app user over the service network.
  gunzip -c "$DIR/db.sql.gz" | dc exec -T "$MYSQL_SERVICE" sh -c \
    'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysql -h mysql -u "$MYSQL_USER" "$MYSQL_DATABASE"'
  log "  database restored"
fi

# 2) MinIO object store ------------------------------------------------------
if [ "$DO_MINIO" -eq 1 ]; then
  MINIO_CID="$(cid_of "$MINIO_SERVICE")"
  [ -n "$MINIO_CID" ] || die "minio service '$MINIO_SERVICE' is not running"
  log "restoring MinIO object store ..."
  dc stop "$MINIO_SERVICE" >/dev/null 2>&1 || true
  # MSYS_NO_PATHCONV: see backup.sh — keeps container paths intact on Windows.
  MSYS_NO_PATHCONV=1 docker run --rm --volumes-from "$MINIO_CID" -v "$DIR:/backup:ro" "$HELPER_IMAGE" \
    sh -c 'rm -rf /data/* /data/.[!.]* /data/..?* 2>/dev/null; tar xzf /backup/minio.tar.gz -C /data'
  dc start "$MINIO_SERVICE" >/dev/null 2>&1 || true
  log "  MinIO restored"
fi

# Bring the app back up.
if [ "$STOP_WEB" -eq 1 ]; then
  log "starting app services ..."
  for s in $WEB_SERVICES; do dc start "$s" >/dev/null 2>&1 || true; done
fi

log "restore complete from $DIR"

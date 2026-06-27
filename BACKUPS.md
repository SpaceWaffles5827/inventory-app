# Backups & restore

Automated backup + restore for every inventory-app service that holds **state**.
Stateless/derived services (Redis cache + sessions) are skipped — they
regenerate on demand.

## What gets backed up

| State | Source | In the backup |
|-------|--------|----------------|
| **Database** (users, workspaces, items, lots, locations, …) | MySQL container, via `mysqldump` | `db.sql.gz` |
| **Uploaded files** (item images) | MinIO `/data` volume | `minio.tar.gz` |

Each run writes a timestamped folder under `backups/`:

```
backups/
  2026-06-27_033001/
    db.sql.gz
    minio.tar.gz
    MANIFEST.txt      # host, git sha, sha256 checksums
    backup.log
  latest -> 2026-06-27_033001
  backup.log          # rolling log across all runs
```

## Run a backup manually

```bash
pnpm backup             # or: bash scripts/backup.sh
```

## Schedule it (nightly, automatic)

```bash
pnpm backup:install-cron            # 03:30 every day
# custom schedule:
BACKUP_CRON='0 */12 * * *' pnpm backup:install-cron
# remove it:
bash scripts/backup-cron.install.sh --uninstall
```

`03:30 daily` keeps potential data loss to ~24h at one snapshot/day. Confirm
the job with `crontab -l`; cron output goes to `backups/cron.log`.

## Retention / rollover (storage stays bounded)

- Always keeps the **newest `MIN_KEEP`** runs (default **7**) — so you never
  lose recent snapshots even if backups silently stop.
- Of the rest, deletes anything older than **`RETENTION_DAYS`** (default **14**).

Tune via `scripts/backup.env` (see below).

## Restore

```bash
pnpm restore                          # restore EVERYTHING from the newest backup
bash scripts/restore.sh 2026-06-27_033001   # a specific backup
bash scripts/restore.sh latest --db   # only the database
```

Flags: `--db` / `--minio` (pick components), `--yes` (skip the confirmation
prompt), `--no-stop` (don't stop the app/server containers during restore).
Restore is **destructive** — it overwrites live data and asks you to type
`RESTORE` first (unless `--yes`).

## Dev vs prod

The scripts default to the **prod** stack:

```bash
DC="docker compose -p inventory-prod -f docker-compose.yml --env-file .env"
```

To back up the **local dev** stack instead, create `scripts/backup.env`
(gitignored) from the example and set:

```bash
cp scripts/backup.env.example scripts/backup.env
# then in scripts/backup.env:
DC="docker compose -p inventory-app-dev -f docker-compose.dev.yml --env-file .dev.env"
```

All other settings (`BACKUP_DIR`, `RETENTION_DAYS`, `MIN_KEEP`, `OFFSITE_CMD`)
are optional overrides in the same file. Credentials are **not** configured
here — `mysqldump`/`mysql` run inside the MySQL container and read
`MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` from its own environment.

## ⚠️ Get a copy OFF the server

By default backups land in `backups/` — the **same disk** as the app. That
covers fat-fingered deletes and bad migrations, but **not** disk failure, the
box dying, or ransomware. For real disaster recovery, either point `BACKUP_DIR`
at a separate disk/mount, or set `OFFSITE_CMD` to push each backup off-box:

```bash
# in scripts/backup.env
OFFSITE_CMD='rsync -a "$1" backups@nas:/inventory-app/'
# or to cloud object storage:
OFFSITE_CMD='rclone copy "$1" r2:inventory-app-backups/$(basename "$1")'
```

It runs after each successful backup with `$1` = the new backup folder.

> Note: this is the self-contained, on-demand backup kit. It is independent of
> the in-compose MinIO replication / `mysql-dump-to-minio` services (which push
> to a remote DR MinIO). Use whichever fits; they don't conflict.

## Moving to a new machine

1. Copy the repo + `.env` to the new box and `pnpm prod:build`.
2. Copy a backup folder over (or pull it from your off-site location).
3. `bash scripts/restore.sh <that-folder>`.

You're back — database and uploaded files included.

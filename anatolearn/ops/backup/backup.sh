#!/bin/sh
# Dumps the database to S3 every BACKUP_INTERVAL_HOURS (default 24). Credentials come from the EC2 instance role.
# Retention is handled by an S3 lifecycle rule on the backups/ prefix (see docs/Deployment.md).
set -u
: "${S3_BUCKET:?S3_BUCKET is required}"
PREFIX="${S3_PREFIX:+$S3_PREFIX/}"
INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
log() { printf '{"time":"%s","level":"%s","msg":"%s","file":"%s"}\n' "$(date -u +%FT%TZ)" "$1" "$2" "${3:-}"; }
while true; do
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  file="/tmp/db-$stamp.dump"
  if pg_dump --format=custom --no-owner --file="$file" \
     && aws s3 cp "$file" "s3://$S3_BUCKET/${PREFIX}backups/db-$stamp.dump" --only-show-errors; then
    touch /tmp/last-backup-ok
    log info "backup ok" "db-$stamp.dump"
  else
    log error "backup failed" "db-$stamp.dump"
  fi
  rm -f "$file"
  sleep $((INTERVAL_HOURS * 3600))
done

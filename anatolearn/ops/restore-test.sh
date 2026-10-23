#!/bin/sh
# Proves a backup is restorable: downloads the newest dump from S3, restores it into a throwaway database and prints row counts.
# Run from the anatolearn folder:
#   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm --entrypoint sh backup /ops/restore-test.sh
set -eu
: "${S3_BUCKET:?}"; PREFIX="${S3_PREFIX:+$S3_PREFIX/}"
latest="$(aws s3 ls "s3://$S3_BUCKET/${PREFIX}backups/" | awk '{print $4}' | sort | tail -n 1)"
[ -n "$latest" ] || { echo "No backups found" >&2; exit 1; }
echo "Restoring $latest"
aws s3 cp "s3://$S3_BUCKET/${PREFIX}backups/$latest" /tmp/restore.dump --only-show-errors
target="restore_test_$(date +%s)"
createdb "$target"
trap 'dropdb --if-exists "$target"' EXIT
pg_restore --no-owner --exit-on-error --dbname="$target" /tmp/restore.dump
psql -XAt -d "$target" -c "SELECT 'users', count(*) FROM users UNION ALL SELECT 'models', count(*) FROM models UNION ALL SELECT 'videos', count(*) FROM videos UNION ALL SELECT 'quizzes', count(*) FROM quizzes UNION ALL SELECT 'attempts', count(*) FROM quiz_attempts"
echo "Restore test passed"

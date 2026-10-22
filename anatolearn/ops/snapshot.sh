#!/usr/bin/env bash
set -euo pipefail
umask 077
mode=${1:?backup or verify}
name=${2:?snapshot name}
[[ $name =~ ^snapshot-[0-9]{8}-[0-9]{6}$ ]] || { echo 'Invalid snapshot name' >&2; exit 1; }
snapshot=/backups/$name
counts="SELECT json_build_object('users',(SELECT count(*) FROM users),'models',(SELECT count(*) FROM models),'videos',(SELECT count(*) FROM videos),'quizzes',(SELECT count(*) FROM quizzes),'resources',(SELECT count(*) FROM resources),'attempts',(SELECT count(*) FROM quiz_attempts));"
if [[ $mode == backup ]]; then
  mkdir "$snapshot"
  pg_dump --format=custom --no-owner --file="$snapshot/database.dump"
  tar -C /assets -czf "$snapshot/assets.tar.gz" .
  (cd /assets && find . -type f -print0 | sort -z | xargs -0 -r sha256sum) > "$snapshot/assets.sha256"
  psql -XAt -v ON_ERROR_STOP=1 -c "$counts" > "$snapshot/counts.json"
  (cd "$snapshot" && sha256sum database.dump assets.tar.gz assets.sha256 counts.json > SHA256SUMS)
  echo "Snapshot saved: $name"
elif [[ $mode == verify ]]; then
  (cd "$snapshot" && sha256sum -c SHA256SUMS)
  target=restore_${name//-/_}
  # Both commands fail if their target already exists. Never replace a database or folder.
  mkdir "$snapshot/restored-assets"
  createdb "$target"
  pg_restore --exit-on-error --no-owner --dbname="$target" "$snapshot/database.dump"
  tar -C "$snapshot/restored-assets" -xzf "$snapshot/assets.tar.gz"
  (cd "$snapshot/restored-assets" && sha256sum -c ../assets.sha256)
  psql -XAt -v ON_ERROR_STOP=1 -d "$target" -c "$counts" > "$snapshot/restored-counts.json"
  cmp "$snapshot/counts.json" "$snapshot/restored-counts.json"
  echo "Verified isolated restore: database=$target assets=$snapshot/restored-assets"
else
  echo 'Expected backup or verify' >&2; exit 1
fi

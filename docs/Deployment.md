# Deployment

Production stack: `anatolearn/docker-compose.prod.yml` (Postgres + Node API + nginx serving the built SPA).
Only the `web` container is published (`WEB_PORT`, default 8080). Put HTTPS in front of it (Caddy, a cloud load balancer, Cloudflare...).

```bash
cd anatolearn
cp .env.production.example .env.production   # fill in secrets: openssl rand -base64 48
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Required settings (`.env.production`)
| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | Database password |
| `JWT_SECRET` | 32+ random characters; the API refuses to start without it |
| `TEACHER_INVITE_CODE` | Code teachers enter on the Register page. Students need none |
| `FRONTEND_ORIGINS` | Public site origin(s), e.g. `https://anatolearn.example.com` (CORS / CSRF origin check) |

`TRUST_PROXY=2` is set in the compose file (TLS proxy + nginx). Change it to match your proxy chain, otherwise rate limiting sees the wrong client IP.

## First teacher account
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -e TEACHER_PASSWORD='ChangeMe123' backend \
  node scripts/create-teacher.js "Admin Name" admin@example.com 1
```

## Data
- Database: volume `postgres_data`. Uploads (models, videos, captions, resources, thumbnails): volume `uploads`.
- Back up both. `ops/snapshot.sh` works with the dev compose file's `operations` profile.
- Schema/seed SQL in `backend/sql` only runs on an empty database. `002_seed.sql` inserts demo rows pointing at sample files (`/models/anatomy/scene.glb`, `/videos/s.mp4`) that are not in the empty `uploads` volume; delete those rows or upload the files.

## Development
`docker-compose.yml` is dev-only (Vite dev server, bind mounts, ports bound to 127.0.0.1). Do not expose it publicly.

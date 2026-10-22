# Deployment (AWS EC2 + S3)

Stack (`anatolearn/docker-compose.prod.yml`): **Caddy** (HTTPS, ports 80/443) -> **nginx** (serves the built SPA, proxies API) -> **Node API** -> **Postgres** (container volume). All teaching assets (models, videos, captions, resources, thumbnails) are stored in **S3**; the API streams them to authenticated users, so the bucket stays private and no CORS/CSP changes are needed.

## 1. S3 bucket
- Create a bucket in your region. Keep **Block all public access ON**. No bucket CORS needed.
- Optional: set `S3_PREFIX` (e.g. `prod`) to keep several environments in one bucket.

## 2. IAM role for the instance (no access keys)
Create a role for EC2 and attach it to the instance:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::YOUR_BUCKET/*" }
  ]
}
```
Docker containers reach the instance-role credentials through the metadata service, which needs a **hop limit of 2** (default 1 blocks containers):
```bash
aws ec2 modify-instance-metadata-options --instance-id i-XXXX --http-tokens required --http-put-response-hop-limit 2
```

## 3. EC2 instance
- Amazon Linux 2023 / Ubuntu, t3.small or larger, 20 GB+ disk (uploads are staged briefly in the container; the database lives on the instance disk).
- Security group: allow **80 and 443** from anywhere, **22 only from your IP**. Do not open 5432/5000/8080.
- Point a DNS A record (use an Elastic IP) for your domain at the instance.
- Install Docker + the compose plugin, then `git clone` the repo.

## 4. Configure and start
```bash
cd anatolearn
cp .env.production.example .env.production   # fill in; openssl rand -base64 48 for secrets
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```
| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | Database password |
| `JWT_SECRET` | 32+ random characters; the API refuses to start without it |
| `TEACHER_INVITE_CODE` | Code teachers enter on the Register page. Students need none |
| `SITE_DOMAIN` / `FRONTEND_ORIGINS` | Domain for HTTPS, and the public origin `https://<domain>` |
| `AWS_REGION`, `S3_BUCKET`, `S3_PREFIX` | Storage location |

## 5. First teacher account
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -e TEACHER_PASSWORD='ChangeMe123' backend \
  node scripts/create-teacher.js "Admin Name" admin@example.com 1
```

## Existing files / sample content
`backend/sql/002_seed.sql` inserts demo rows pointing at `/models/anatomy/scene.glb` and `/videos/s.mp4`. Either delete them or copy the files into the bucket, keeping the same paths (add your prefix if set):
```bash
aws s3 sync anatolearn/public/videos s3://YOUR_BUCKET/PREFIX/videos --exclude "*" --include "s.mp4"
aws s3 sync <local models dir> s3://YOUR_BUCKET/PREFIX/models
```
To migrate an old local deployment, sync its `public/{models,videos,captions,resources,thumbnails}` folders the same way.

## Backups
- S3: enable bucket versioning (and optionally lifecycle rules).
- Database: schedule `pg_dump` from the postgres container to S3, e.g. `docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U anatolearn -Fc anatolearn | aws s3 cp - s3://YOUR_BUCKET/backups/db-$(date +%F).dump`. `ops/snapshot.sh` is for the dev stack. Consider RDS instead of the Postgres container if you want managed backups.

## Local / development
`docker-compose.yml` is dev-only (Vite dev server, local disk storage, ports bound to 127.0.0.1). Without `STORAGE_DRIVER` the API stores files under `PUBLIC_DIR` on disk. Do not expose the dev stack publicly.

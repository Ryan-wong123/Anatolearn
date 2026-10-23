# Deployment Guide: AWS EC2 + S3

Everything needed to take AnatoLearn from a fresh AWS account to a running, monitored HTTPS site.

## Architecture

```
Browser --HTTPS--> Caddy (80/443, auto certificate)
                     -> nginx (serves built React app, proxies /api and asset paths)
                          -> Node API --> Postgres (container, volume on EC2 disk; runtime role has DML rights only)
                                     |--> ClamAV (every upload is virus-scanned before it reaches S3)
                                     \--> S3 (private bucket; API streams files after access checks)
backup container --> nightly pg_dump --> S3 backups/        CloudWatch: logs, alarms, uptime check
```

- Only Caddy is exposed to the internet. Postgres, ClamAV, the API and nginx are internal to the Docker network.
- The S3 bucket is private. The API checks login, role, programme and publish state, then streams the file to the user. No CORS or presigned URLs are needed.
- AWS credentials come from the EC2 **instance role**. Never put access keys in files.
- See `docs/Security.md` for the full list of security controls.

## Checklist

- [ ] 1. Choose a region and a domain name
- [ ] 2. Create the S3 bucket
- [ ] 3. Create the IAM policy, role and instance profile
- [ ] 4. Create the security group
- [ ] 5. Launch the EC2 instance and attach an Elastic IP
- [ ] 6. Set the instance metadata hop limit to 2
- [ ] 7. Point DNS at the Elastic IP
- [ ] 8. Install Docker on the instance
- [ ] 9. Clone the repo and create `.env.production`
- [ ] 10. Start the stack
- [ ] 11. Create the first administrator account
- [ ] 12. Verify content, uploads and the virus scanner
- [ ] 13. Check backups and run a restore test
- [ ] 14. Set up CloudWatch logs and alarms
- [ ] 15. Complete the privacy notice and terms

Commands below use the AWS CLI. Everything can also be done in the AWS console. Replace the placeholders in `UPPER_CASE`.

```bash
export AWS_REGION=ap-southeast-1        # your region
export BUCKET=anatolearn-assets-YOURNAME # bucket names are globally unique
export DOMAIN=anatolearn.example.com
```

---

## 1. Prerequisites

- An AWS account and the AWS CLI configured (`aws configure`) with permission to manage S3, IAM, EC2, CloudWatch, SNS and Route 53.
- A domain name you can edit DNS for (Route 53 or any registrar).
- Decide a **teacher invite code** and the email domains allowed to register (step 9).

## 2. S3 bucket

```bash
aws s3api create-bucket --bucket $BUCKET --region $AWS_REGION \
  --create-bucket-configuration LocationConstraint=$AWS_REGION
# (in us-east-1 omit --create-bucket-configuration)

# Keep the bucket private
aws s3api put-public-access-block --bucket $BUCKET \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Encrypt at rest and keep old versions so deleted or overwritten files can be recovered
aws s3api put-bucket-encryption --bucket $BUCKET \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-bucket-versioning --bucket $BUCKET --versioning-configuration Status=Enabled
```

No bucket CORS configuration is needed. Optional: set `S3_PREFIX` (e.g. `prod`) to share one bucket between environments. Lifecycle rules for backups are added in step 13.

## 3. IAM role for the instance

```bash
cat > policy.json <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::$BUCKET/*" },
    { "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::$BUCKET" },
    { "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"],
      "Resource": "arn:aws:logs:*:*:log-group:/anatolearn/*" }
  ]
}
POLICY
cat > trust.json <<'TRUST'
{ "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Principal": { "Service": "ec2.amazonaws.com" }, "Action": "sts:AssumeRole" }] }
TRUST

aws iam create-policy --policy-name anatolearn-app --policy-document file://policy.json
aws iam create-role --role-name anatolearn-ec2 --assume-role-policy-document file://trust.json
aws iam attach-role-policy --role-name anatolearn-ec2 \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/anatolearn-app
# Memory and disk metrics for step 14
aws iam attach-role-policy --role-name anatolearn-ec2 \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy
aws iam create-instance-profile --instance-profile-name anatolearn-ec2
aws iam add-role-to-instance-profile --instance-profile-name anatolearn-ec2 --role-name anatolearn-ec2
```

`s3:ListBucket` is only needed by the backup restore test. The logs statement lets Docker ship container logs to CloudWatch.

## 4. Security group

Create it in your VPC (console: EC2 -> Security Groups, or CLI):

| Port | Source | Purpose |
|---|---|---|
| 80 | 0.0.0.0/0 | HTTP (certificate issuance + redirect to HTTPS) |
| 443 | 0.0.0.0/0 | HTTPS |
| 22 | **your IP only** | SSH |

Do **not** open 5432, 5000 or 8080.

```bash
SG=$(aws ec2 create-security-group --group-name anatolearn --description "AnatoLearn" --vpc-id VPC_ID --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp --port 80  --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp --port 22  --cidr YOUR_IP/32
```

## 5. Launch the EC2 instance

- AMI: Ubuntu 24.04 LTS (or Amazon Linux 2023).
- Type: **`t3.large` (8 GB RAM) recommended.** ClamAV alone uses 1.5-2 GB and the frontend build needs about 2 GB. On a `t3.medium` it works with 2 GB of swap. On smaller instances remove the `clamav` service from `docker-compose.prod.yml`, delete its `depends_on` entry and the `CLAMAV_*` settings (uploads are then validated but not virus-scanned).
- Storage: 30 GB gp3 or more (database, Docker images, ClamAV signatures, upload staging).
- Key pair: create or select one for SSH.
- Security group: the one from step 4. IAM instance profile: `anatolearn-ec2`.

Then allocate and attach an Elastic IP so the address survives restarts:

```bash
ALLOC=$(aws ec2 allocate-address --query AllocationId --output text)
aws ec2 associate-address --instance-id i-INSTANCE_ID --allocation-id $ALLOC
```

## 6. Instance metadata hop limit (required for Docker)

Containers get the role's credentials through the instance metadata service. With the default hop limit of 1 they cannot reach it, and S3 calls fail with "Could not load credentials".

```bash
aws ec2 modify-instance-metadata-options --instance-id i-INSTANCE_ID \
  --http-tokens required --http-put-response-hop-limit 2 --http-endpoint enabled
```

## 7. DNS

Create an **A record** for `$DOMAIN` pointing to the Elastic IP. Wait until `dig +short $DOMAIN` returns that IP. Caddy cannot get a certificate until this resolves and ports 80/443 are open.

## 8. Install Docker on the instance

```bash
ssh -i KEY.pem ubuntu@$DOMAIN

# Ubuntu
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker compose version   # confirm the compose plugin is present

# Optional swap (needed on t3.medium)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Automatic OS security updates
sudo apt-get install -y unattended-upgrades
```

## 9. Get the code and configure

```bash
git clone https://github.com/ryan-wong123/itp-team-12.git
cd itp-team-12/anatolearn
git checkout BRANCH_TO_DEPLOY
cp .env.production.example .env.production
nano .env.production
chmod 600 .env.production
```

| Variable | Value |
|---|---|
| `POSTGRES_PASSWORD` | Owner password, used by migrations and backups: `openssl rand -hex 24` (avoid `@ / :` characters, they appear in connection URLs) |
| `APP_DB_PASSWORD` | Password for the least-privilege role the API runs as: `openssl rand -hex 24`. Only read when the database volume is first created |
| `JWT_SECRET` | `openssl rand -base64 48` (the API refuses to start if shorter than 32 characters) |
| `TEACHER_INVITE_CODE` | A code you share only with teachers; they enter it on the Register page |
| `ALLOWED_EMAIL_DOMAINS` | Optional but strongly recommended. Comma-separated email domains allowed to register, e.g. `school.edu,students.school.edu`. Stops strangers creating accounts |
| `SITE_DOMAIN` / `FRONTEND_ORIGINS` | `anatolearn.example.com` (no `https://`) and `https://anatolearn.example.com` (no trailing slash; comma-separate several) |
| `AWS_REGION`, `S3_BUCKET`, `S3_PREFIX` | Storage location (prefix optional) |
| `CLAMAV_REQUIRED` | `true` (default) rejects uploads while the scanner is down; `false` lets them through with a log warning |
| `BACKUP_INTERVAL_HOURS` | Database backup frequency, default 24 |

Keep `.env.production` out of git (it is already ignored).

## 10. Start the stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml ps          # all services "running"/"healthy"
docker compose -f docker-compose.prod.yml logs -f backend caddy
```

On first start:
- Postgres creates the owner role and the `anatolearn_app` runtime role (`ops/postgres-init`).
- The API applies any pending database migrations (`backend/sql/*.sql`, tracked in `schema_migrations`) before it starts listening. A failed migration stops startup with the file name in the log, so a broken deploy never serves half-migrated data.
- ClamAV downloads its virus signatures, which takes 2-5 minutes; the API waits for it to report healthy.
- Visit `https://$DOMAIN`. The first load may take a minute while Caddy obtains the certificate.

## 11. Create the first administrator account

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec \
  -e ADMIN_PASSWORD='A-strong-password-1' backend \
  node scripts/create-admin.js "Admin Name" admin@example.com
```

The password needs 8-72 characters with an uppercase letter and a number. Running the script for an existing email promotes that account to administrator (and signs it out everywhere); leave `ADMIN_PASSWORD` unset to keep its current password. Administrators have no learning pages: they only manage accounts and read the audit log. Teachers register themselves with the invite code, or an administrator creates them under **Users**. From then on administrators manage accounts (disable, unlock, reset passwords, change roles) in the app; teachers cannot.

## 12. Content and verification

Production starts empty: only the four programmes are created. The demo rows used in development (`backend/seed/demo.sql`) are **never** loaded in production and `npm run seed:demo` refuses to run when `NODE_ENV=production`. Teachers add real content through the site.

To migrate files from an older local deployment, sync its folders keeping the same paths and then insert the matching database rows:

```bash
for d in models videos captions resources thumbnails; do
  aws s3 sync public/$d s3://$BUCKET/PREFIX/$d
done
```

Smoke test:
1. `curl -s https://$DOMAIN/api/health` returns `{"status":"ok"}`.
2. Sign in as the administrator. Open **Users -> Audit log** and confirm your sign-in is listed.
3. Upload a model, a video (with a `.vtt` caption) and a resource. Watch the upload progress bar and confirm the objects appear: `aws s3 ls s3://$BUCKET/PREFIX/ --recursive`.
4. Test the scanner end to end with the harmless EICAR test string. Save this single line as `eicar.pdf` and try to upload it as a library resource; it must be rejected as flagged by the virus scanner:
   `X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`
5. Register a student (the email domain must be allowed). Confirm they see only published content for their programme, that video seeking works, and that `curl -I https://$DOMAIN/videos/FILE.mp4` without a session returns 401.
6. Post an announcement as a teacher and check the student sees the bell badge.

## 13. Backups and restore test

- **Files:** S3 versioning (step 2) protects against accidental deletes.
- **Database:** the `backup` container runs `pg_dump` every `BACKUP_INTERVAL_HOURS` (default 24, first run at start-up) and uploads to `s3://$BUCKET/PREFIX/backups/db-<timestamp>.dump`. Its container health turns unhealthy if no backup succeeded in twice the interval.
- **Retention:** expire old dumps and old file versions with a lifecycle rule (set `BACKUP_PREFIX` to your `S3_PREFIX` plus a slash, or leave it empty):

```bash
BACKUP_PREFIX=""
cat > lifecycle.json <<RULES
{ "Rules": [
  { "ID": "expire-db-backups", "Status": "Enabled", "Filter": { "Prefix": "${BACKUP_PREFIX}backups/" }, "Expiration": { "Days": 35 } },
  { "ID": "expire-old-versions", "Status": "Enabled", "Filter": {}, "NoncurrentVersionExpiration": { "NoncurrentDays": 60 } }
] }
RULES
aws s3api put-bucket-lifecycle-configuration --bucket $BUCKET --lifecycle-configuration file://lifecycle.json
```

- **Prove it works:** restore the newest backup into a throwaway database and print row counts. Do this once after setup and then monthly:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm --entrypoint sh backup /ops/restore-test.sh
```

- **Real restore:** stop the API, restore into the postgres container as the owner (`pg_restore --clean --no-owner -d anatolearn <file>`), start the API.
- Consider RDS for PostgreSQL instead of the container for point-in-time recovery: change `DATABASE_URL` and `MIGRATION_DATABASE_URL`, create the `anatolearn_app` role there with the SQL in `ops/postgres-init/10-app-role.sh`, and remove the `postgres` service.
- Keep `.env.production` somewhere safe; losing `JWT_SECRET` only logs users out, but the database passwords are needed to recover.

## 14. Monitoring and alerts

**Logs.** The API prints one JSON line per request (method, path without query string, status, duration, user id, IP, request id) and errors at `"level":"error"`. To ship all container logs to CloudWatch Logs, start the stack with the override file (needs the IAM statement from step 3):

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.cloudwatch.yml --env-file .env.production up -d
```

**Alarms and uptime check.** The script creates an SNS email topic, alarms for EC2 status, CPU, application errors, memory, disk and missing backups, and a Route 53 health check on `/api/health`:

```bash
cd ops/cloudwatch
INSTANCE_ID=i-XXXX ALERT_EMAIL=you@example.com DOMAIN=$DOMAIN AWS_REGION=$AWS_REGION ./setup-alarms.sh
```

Confirm the two SNS subscription emails (one per region). For the memory and disk alarms install the CloudWatch agent on the instance and load the supplied config:

```bash
sudo apt-get install -y amazon-cloudwatch-agent   # or download the package from AWS
sudo amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:$PWD/amazon-cloudwatch-agent.json
```

Useful Logs Insights queries on `/anatolearn/production`:
- Server errors: `fields @timestamp, status, path, ms | filter status >= 500 | sort @timestamp desc`
- Traffic by status: `filter msg = "request" | stats count() by status`

The in-app audit trail (Users -> Audit log) covers who did what; the log group covers how the service behaved.

## 15. Before launch

- Complete the **Privacy notice** and **Terms of use** pages (`anatolearn/src/pages/Privacy.tsx`, `Terms.tsx`) with your institution's contact details and policies, and have them reviewed. Registration requires consent to both.
- Decide who the administrators are (keep at least two), remove unused teacher accounts, and agree how often the audit log is reviewed.

---

## Updating the site

```bash
cd itp-team-12/anatolearn
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Database changes are automatic: every new numbered file in `backend/sql` (e.g. `015_something.sql`) is applied once, inside a transaction, when the API starts, and recorded in `schema_migrations`. Never edit a file that has already been applied; add a new one. The runner needs the owner role, so keep `MIGRATION_DATABASE_URL` set. Run migrations manually with `docker compose -f docker-compose.prod.yml exec backend node src/migrate.js`. While the API restarts users see a friendly "being updated" page.

### Upgrading an existing deployment to this version

- Take a backup first.
- Databases created before migrations existed are detected: `001_schema.sql` and `002_seed.sql` are marked as applied (they would otherwise wipe data) and the rest run normally.
- If your Postgres volume already exists, the init script that creates the `anatolearn_app` role does **not** run again. Create the role by hand once, then add `APP_DB_PASSWORD` to `.env.production`:

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U anatolearn -d anatolearn
```

```sql
CREATE ROLE anatolearn_app LOGIN PASSWORD 'THE_APP_DB_PASSWORD';
GRANT CONNECT ON DATABASE anatolearn TO anatolearn_app;
GRANT USAGE ON SCHEMA public TO anatolearn_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anatolearn_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anatolearn_app;
ALTER DEFAULT PRIVILEGES FOR ROLE anatolearn IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anatolearn_app;
ALTER DEFAULT PRIVILEGES FOR ROLE anatolearn IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anatolearn_app;
```

- Login responses no longer contain a token and cookie-authenticated writes need the CSRF header. Scripts must send `Authorization: Bearer <session cookie value>` instead (exempt from CSRF).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Compose says a variable is required | A value is missing from `.env.production`; compose names which one |
| Backend exits: `JWT_SECRET must be set...` | Secret missing or under 32 characters |
| Backend exits: `FRONTEND_ORIGINS must list...` | Set it to `https://your-domain` |
| Backend exits: `Migration NNN failed` | Read the error in `docker compose logs backend`; fix it in a new migration file. The failed migration was rolled back |
| Backend exits with `password authentication failed` | `APP_DB_PASSWORD` differs from the role's password (the role is only created on first database start); see "Upgrading an existing deployment" |
| Uploads or file views fail with `Could not load credentials` | Instance profile not attached, or hop limit not 2 (step 6); recheck with `aws ec2 describe-instances --query 'Reservations[].Instances[].MetadataOptions'` |
| `AccessDenied` from S3 | Policy bucket name or prefix does not match `S3_BUCKET`; region mismatch |
| Uploads fail: "virus scanning is unavailable" (503) | ClamAV is still downloading signatures (first start) or was killed: `docker compose logs clamav`, `docker stats`; the instance may need more memory |
| Browser shows certificate error | DNS not yet pointing at the Elastic IP, or ports 80/443 blocked; see `docker compose logs caddy` |
| Login works but you are logged out immediately / 403 "Untrusted request origin" | `FRONTEND_ORIGINS` does not exactly match the browser origin (scheme, host, no trailing slash) |
| Writes return 403 "Invalid or missing CSRF token" | A script uses the session cookie without the `X-CSRF-Token` header; use a Bearer token, or reload the page in the browser |
| A user cannot sign in after a few attempts | Locked for 15 minutes; a teacher can unlock them under Users |
| Registration says "limited to @school.edu" | `ALLOWED_EMAIL_DOMAINS` is set; use an allowed address, or an administrator can create the account under Users |
| 429 Too many requests | Rate limits (10 logins / 15 min per IP). If every user is limited together, `TRUST_PROXY` does not match the proxy chain (default 2: Caddy + nginx) |
| Large upload fails | nginx allows 210 MB; check backend logs and that ClamAV `StreamMaxLength` (250 MB) is unchanged |
| Backup container unhealthy | `docker compose logs backup`; usually missing `s3:PutObject` permission, wrong region or the hop limit |

## Security notes

See `docs/Security.md` for the full list of controls.

- Rotate `JWT_SECRET` or the invite code by editing `.env.production` and re-running `up -d` (rotating the JWT secret logs everyone out).
- Keep SSH restricted to your IP, apply OS updates regularly (`unattended-upgrades`), and keep IMDSv2 required (`--http-tokens required`, step 6).
- Never open the database port. Keep the bucket private.
- Review the audit log regularly and after any staff change; disable accounts instead of sharing passwords.

## Local development

`docker-compose.yml` is dev-only (Vite dev server, local disk storage, ports bound to 127.0.0.1). Without `STORAGE_DRIVER=s3` the API stores files under `PUBLIC_DIR` on disk, and ClamAV and backups are off. The API applies migrations on start. Load sample content with `docker compose exec backend npm run seed:demo` (wipes content tables; refuses in production). Do not expose the dev stack publicly.

CI (`.github/workflows/ci.yml`) runs backend unit and integration tests against Postgres, frontend lint, tests and build, `npm audit`, and production image builds on every pull request. Dependabot opens weekly update PRs.

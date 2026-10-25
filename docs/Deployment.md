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

- Teacher and administrator accounts sign in with a password **and** a code from an authenticator app (two-factor authentication, enforced by `MFA_REQUIRED`; see step 11).
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
- [ ] 11. Create the first administrator account and enrol it in two-factor authentication
- [ ] 12. Verify content, uploads and the virus scanner
- [ ] 13. Check backups and run a restore test
- [ ] 14. Set up CloudWatch logs and alarms
- [ ] 15. Complete the privacy notice and terms, and switch on the GitHub security features

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
- Every teacher and administrator needs a phone with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy or similar). The instance clock must be correct: codes are time-based, so keep NTP on (Ubuntu 24.04 and Amazon Linux 2023 do by default).

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
| `MFA_REQUIRED` | `true` (the default in `docker-compose.prod.yml`) forces every teacher and administrator to set up two-factor authentication before they can use the site, and stops them turning it off. `false` makes it optional |
| `MFA_ENCRYPTION_KEY` | **Set this before anyone enrols**: `openssl rand -hex 32` (at least 32 characters). It encrypts the stored authenticator secrets. If left empty the key is derived from `JWT_SECRET`. Back it up with the rest of `.env.production`, and never change it afterwards (see "Two-factor authentication" below) |
| `BACKUP_INTERVAL_HOURS` | Database backup frequency, default 24 |

Keep `.env.production` out of git (it is already ignored). CI scans the whole git history for committed secrets.

**Startup checks.** The API validates its configuration when it starts and refuses to run if something is unsafe. It prints every problem at once, for example:

```
Invalid configuration:
 - JWT_SECRET looks like a placeholder or has too little variety; generate one with: openssl rand -base64 48
 - FRONTEND_ORIGINS "http://anatolearn.example.com" must use https in production
```

It stops for: a `JWT_SECRET` that is under 32 characters, a placeholder (`changeme`, `secret`, `dev-only...`) or has fewer than 10 distinct characters; `FRONTEND_ORIGINS` that is not a bare `https://` origin (no path, no trailing slash, no wildcard, not localhost); and a `MFA_ENCRYPTION_KEY` under 32 characters. It only warns (look for `WARNING:` in `docker compose logs backend`) when `MFA_REQUIRED` is not `true`, `MFA_ENCRYPTION_KEY` is empty, `ALLOWED_EMAIL_DOMAINS` is empty, the invite code is under 12 characters, ClamAV is off or not required, `TRUST_PROXY` is missing, rate limiting or audit logging is disabled, or the API connects to Postgres as a superuser. Treat warnings as a to-do list.

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
- Check `docker compose -f docker-compose.prod.yml logs backend | grep WARNING`. A clean production setup prints no warnings.
- Caddy sends `Strict-Transport-Security: max-age=31536000` (one year). Once a browser has visited, it refuses plain HTTP for this domain for that long, so only use a domain you will serve over HTTPS. It deliberately omits `includeSubDomains` and `preload`; add them to `ops/Caddyfile` only if every subdomain of the parent domain is HTTPS-only. Check it with `curl -sI https://$DOMAIN | grep -i strict-transport`.

## 11. Create the first administrator account

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec \
  -e ADMIN_PASSWORD='A-strong-password-1' backend \
  node scripts/create-admin.js "Admin Name" admin@example.com
```

The administrator password must be **at least 12 characters** (up to 72 bytes) with an uppercase letter and a number, must not be a common password (`Password1`, `Welcome2024`, `P@ssw0rd!` and similar are refused) and must not contain the name or email address. Four unrelated words and a number, such as `Blue-Tractor-Lamp-7`, work well. The script prints the reason if it refuses. The same rules apply to every password set in the app: students need 8 characters, teachers and administrators 12. Existing accounts are not forced to change a password that was set before this rule, so ask staff to update short ones from their Profile page. **Do not skip the next part.**

### Two-factor authentication

With `MFA_REQUIRED=true` the first administrator is sent to the **Profile** page straight after signing in and cannot use anything else until two-factor authentication is set up:

1. Under *Two-factor authentication* choose **Set up**, enter the password, and scan the QR code with an authenticator app (or type the key in manually).
2. Enter the 6-digit code to turn it on.
3. Save the **10 recovery codes** shown (a password manager is ideal). Each works once, they are shown only now, and they are the way back in if the phone is lost.

From then on every sign-in asks for a code (or a recovery code). Wrong codes count towards the same 5-attempt lockout as wrong passwords, and a code can only be used once.

- **Create a second administrator now and enrol it.** An administrator who loses their phone and recovery codes can only be reset by *another* administrator (**Users -> Reset 2FA**). Administrators cannot reset themselves. If you have only one, use the database fix under Troubleshooting.
- **Teachers** are enrolled the same way: the first time they sign in after `MFA_REQUIRED` is on, they are taken to their Profile to set it up. Students are never asked.
- **Lost phone:** an administrator opens **Users**, clicks **Reset 2FA** on that person (this signs them out everywhere), and the person signs in with their password and enrols again. Recovery codes can be regenerated on the Profile page (password and a current code needed).
- **Never change `MFA_ENCRYPTION_KEY`** (or, if it is empty, `JWT_SECRET`) after people have enrolled. Their stored secrets can no longer be decrypted and every one of them has to be reset. If you must rotate it, plan to reset everyone.
- Scripts and integrations that sign in as a teacher or administrator cannot use the two-step sign-in. Use a student-level account, or enrol the account first and use its session. Running the script for an existing email promotes that account to administrator (and signs it out everywhere); leave `ADMIN_PASSWORD` unset to keep its current password. Administrators have no learning pages: they only manage accounts and read the audit log. Teachers register themselves with the invite code, or an administrator creates them under **Users**. From then on administrators manage accounts (disable, unlock, reset passwords, change roles) in the app; teachers cannot.

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
7. Two-factor authentication: sign out and back in as the administrator. After the password you must get the *Two-step verification* prompt. A wrong code is refused, a correct one signs you in, and the same code is refused if you try to reuse it on a second sign-in within 30 seconds.
8. Sign in as a new teacher who has not enrolled: they must land on the Profile page and every other page must send them back until they finish setup. A student must go straight to the dashboard.
9. Upload checks: rename a text file to `video.mp4` and try to upload it as a video. It must be rejected with "The file contents do not match an MP4 or WebM video".
10. `curl -sI https://$DOMAIN | grep -i strict-transport` shows `max-age=31536000`.

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
- Decide who the administrators are (keep at least two, both enrolled in two-factor authentication), remove unused teacher accounts, and agree how often the audit log is reviewed. Tell staff before enabling `MFA_REQUIRED`: on their next page load they are held on the Profile page until they set up.
- Turn on the GitHub security features for the repository (Settings):
  - **Code security -> Code scanning**: the workflow `.github/workflows/codeql.yml` runs CodeQL on every pull request, on `main` and weekly, and reports to the Security tab. On a **private** repository this needs GitHub Advanced Security; without it the upload step fails. On a public repository it is free.
  - **Code security -> Secret scanning and push protection**: blocks pushes that contain known token formats. The CI job `Secret scan` (gitleaks, config in `.gitleaks.toml`) scans the full history on every pull request as a second layer.
  - **Dependabot alerts** (already configured for weekly updates in `.github/dependabot.yml`).
  - **Branches -> Branch protection for `main`**: require pull requests and the checks `Backend tests`, `Frontend lint, tests and build`, `Dependency audit`, `Secret scan` and `Analyze JavaScript and TypeScript` before merging.
- If CodeQL or the secret scan reports a real secret, treat it as leaked: rotate it first (see Security notes), then remove it from the code. Deleting it from a later commit does not remove it from history.

---

## Updating the site

```bash
cd itp-team-12/anatolearn
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Database changes are automatic: every new numbered file in `backend/sql` (e.g. `015_something.sql`) is applied once, inside a transaction, when the API starts, and recorded in `schema_migrations`. Never edit a file that has already been applied; add a new one. The runner needs the owner role, so keep `MIGRATION_DATABASE_URL` set. Run migrations manually with `docker compose -f docker-compose.prod.yml exec backend node src/migrate.js`. While the API restarts users see a friendly "being updated" page.

### Upgrading an existing deployment to this version

- **Two-factor authentication (migration `018_mfa.sql`)** is applied automatically. The compose file now defaults `MFA_REQUIRED` to `true`, so as soon as the new version starts, every teacher and administrator, **including those already signed in**, is held on the Profile page until they enrol. To give staff a grace period, set `MFA_REQUIRED=false` in `.env.production` for the first deploy (enrolment stays available on the Profile page), then switch it to `true` once they have enrolled. Set `MFA_ENCRYPTION_KEY` before the first person enrols.
- The startup checks above are stricter than before. A weak or placeholder `JWT_SECRET`, or `FRONTEND_ORIGINS` with a trailing slash or `http://`, now stops the API from starting; fix `.env.production` and run `up -d` again.
- Caddy now sends HSTS (see step 10), and upload endpoints are limited to 60 uploads per hour per IP. Uploaded videos must be genuine MP4 or WebM files, and `.doc` uploads, which were previously always rejected, now work.

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
| Backend exits: `Invalid configuration:` followed by a list | The startup checks found unsafe values; each line names the variable and what is wrong (step 9). Fix `.env.production` and run `up -d` again |
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
| Registering, changing a password or creating an account fails with "too common or easy to guess" or "must not contain your name or email" | The password policy (`backend/src/passwords.js`) rejects common passwords, keyboard runs, repeated patterns and passwords that include the person's name or email, even with capitals, digits or symbols added. Choose a few unrelated words instead |
| Registration says "limited to @school.edu" | `ALLOWED_EMAIL_DOMAINS` is set; use an allowed address, or an administrator can create the account under Users |
| 429 Too many requests | Rate limits (10 logins / 15 min per IP). If every user is limited together, `TRUST_PROXY` does not match the proxy chain (default 2: Caddy + nginx) |
| A staff member sees the Profile page and nothing else | `MFA_REQUIRED=true` and they have not set up two-factor authentication yet. This is expected: they set it up there |
| "Invalid or expired verification code" at sign-in | Wrong or already-used code, or the 5-minute window after the password expired (click *Back to sign in*). If codes are always rejected, check the phone's time is automatic and the server clock is right (`timedatectl`). Five wrong attempts lock the account for 15 minutes; an administrator can unlock it under Users |
| A staff member lost their phone | An administrator uses **Users -> Reset 2FA** on them. For the only administrator see the database fix below |
| Everyone's codes are rejected, or the API logs `Failed to verify MFA code` after a deploy | `MFA_ENCRYPTION_KEY` (or `JWT_SECRET`, if the key is empty) changed since people enrolled. Restore the old value, or reset two-factor for everyone who had enrolled |
| A script or integration gets 403 `mfa_setup_required` | It signs in as a teacher or administrator who has not enrolled. Enrol that account first, or use a different account |
| Upload rejected: "file contents do not match" | The file is not really what its extension says (a renamed file, a corrupt export, an SVG renamed to `.png`). Re-export it from the original program |
| Uploads return 429 | More than 60 uploads from one IP in an hour |
| Browser insists on HTTPS and will not load the site over HTTP | HSTS (one year). Expected; use HTTPS |
| GitHub Action `Secret scan` fails | Read the log for the file and rule. Real secret: rotate it, then clean the code. Test value: add the file's path to `.gitleaks.toml` |
| GitHub Action `Analyze JavaScript and TypeScript` fails to upload results | Code scanning is not enabled for the repository, or the repository is private without GitHub Advanced Security (step 15) |
| Large upload fails | nginx allows 210 MB; check backend logs and that ClamAV `StreamMaxLength` (250 MB) is unchanged |
| Backup container unhealthy | `docker compose logs backup`; usually missing `s3:PutObject` permission, wrong region or the hop limit |

## Security notes

See `docs/Security.md` for the full list of controls.

- Rotate `JWT_SECRET` or the invite code by editing `.env.production` and re-running `up -d` (rotating the JWT secret logs everyone out, and also breaks stored two-factor secrets if `MFA_ENCRYPTION_KEY` is empty; set it first).
- Keep `MFA_ENCRYPTION_KEY` with the other secrets and out of git. A database backup alone cannot be used to generate codes without it.
- Keep SSH restricted to your IP, apply OS updates regularly (`unattended-upgrades`), and keep IMDSv2 required (`--http-tokens required`, step 6).
- Never open the database port. Keep the bucket private.
- Review the audit log regularly and after any staff change; disable accounts instead of sharing passwords. Events worth watching: `auth.mfa_failed`, `auth.account_locked`, `auth.mfa_recovery_used` (a recovery code was spent, so check it was the person), `user.reset_mfa` and `profile.mfa_disabled`.

### Database fix: the only administrator lost their phone and recovery codes

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U anatolearn -d anatolearn
```

```sql
UPDATE users SET mfa_secret = NULL, mfa_pending_secret = NULL, mfa_enabled_at = NULL, mfa_last_step = NULL,
  mfa_recovery_hashes = '{}' WHERE email = 'admin@example.com';
UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = (SELECT id FROM users WHERE email = 'admin@example.com');
```

They then sign in with the password and enrol again. Do this only after confirming the person's identity out of band.

## Local development

`docker-compose.yml` is dev-only (Vite dev server, local disk storage, ports bound to 127.0.0.1). Without `STORAGE_DRIVER=s3` the API stores files under `PUBLIC_DIR` on disk, and ClamAV and backups are off. The API applies migrations on start. Load sample content with `docker compose exec backend npm run seed:demo` (wipes content tables; refuses in production). Do not expose the dev stack publicly.

CI (`.github/workflows/ci.yml`) runs backend unit and integration tests against Postgres, frontend lint, tests and build, `npm audit`, production image builds and a gitleaks secret scan of the full history on every pull request. `.github/workflows/codeql.yml` runs CodeQL static analysis. Dependabot opens weekly update PRs. Without `MFA_REQUIRED` set, local development and CI do not require two-factor authentication; to try it locally run the stack with `MFA_REQUIRED=true`.

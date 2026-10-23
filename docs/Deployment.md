# Deployment Guide: AWS EC2 + S3

Everything needed to take AnatoLearn from a fresh AWS account to a running HTTPS site.

## Architecture

```
Browser --HTTPS--> Caddy (80/443, auto certificate)
                     -> nginx (serves built React app, proxies /api and asset paths)
                          -> Node API --> Postgres (container, volume on EC2 disk)
                                     \--> S3 (private bucket; API streams files after access checks)
```

- Only Caddy is exposed to the internet. Postgres, the API and nginx are internal to the Docker network.
- The S3 bucket is private. The API checks login, role, programme and publish state, then streams the file to the user. No CORS or presigned URLs are needed.
- AWS credentials come from the EC2 **instance role**. Never put access keys in files.

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
- [ ] 11. Create the first teacher account
- [ ] 12. Upload sample content (optional) and verify
- [ ] 13. Set up backups

Commands below use the AWS CLI. Everything can also be done in the AWS console. Replace the placeholders in `UPPER_CASE`.

```bash
export AWS_REGION=ap-southeast-1        # your region
export BUCKET=anatolearn-assets-YOURNAME # bucket names are globally unique
export DOMAIN=anatolearn.example.com
```

---

## 1. Prerequisites

- An AWS account and the AWS CLI configured (`aws configure`) with permission to manage S3, IAM and EC2.
- A domain name you can edit DNS for (Route 53 or any registrar).
- Decide a **teacher invite code** and generate secrets (step 9).

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

No bucket CORS configuration is needed. Optional: set `S3_PREFIX` (e.g. `prod`) to share one bucket between environments.

## 3. IAM role for the instance

```bash
cat > policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::$BUCKET/*" }
  ]
}
EOF
cat > trust.json <<'EOF'
{ "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Principal": { "Service": "ec2.amazonaws.com" }, "Action": "sts:AssumeRole" }] }
EOF

aws iam create-policy --policy-name anatolearn-s3 --policy-document file://policy.json
aws iam create-role --role-name anatolearn-ec2 --assume-role-policy-document file://trust.json
aws iam attach-role-policy --role-name anatolearn-ec2 \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/anatolearn-s3
aws iam create-instance-profile --instance-profile-name anatolearn-ec2
aws iam add-role-to-instance-profile --instance-profile-name anatolearn-ec2 --role-name anatolearn-ec2
```

If you also store database backups in the same bucket (step 13), add `s3:ListBucket` on `arn:aws:s3:::$BUCKET` only if you need to list them.

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

- AMI: Ubuntu 24.04 LTS (or Amazon Linux 2023). Type: `t3.small` or larger (the frontend build needs ~2 GB RAM; add swap if you use a smaller type).
- Storage: 20 GB gp3 or more (database plus Docker images).
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

# Optional swap for small instances
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
```

## 9. Get the code and configure

```bash
git clone https://github.com/ryan-wong123/itp-team-12.git
cd itp-team-12/anatolearn
git checkout BRANCH_TO_DEPLOY
cp .env.production.example .env.production
nano .env.production
```

| Variable | Value |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -base64 32` |
| `JWT_SECRET` | `openssl rand -base64 48` (the API refuses to start if shorter than 32 characters) |
| `TEACHER_INVITE_CODE` | A code you share only with teachers; they enter it on the Register page |
| `SITE_DOMAIN` | `anatolearn.example.com` (no `https://`) |
| `FRONTEND_ORIGINS` | `https://anatolearn.example.com` (no trailing slash; comma-separate several) |
| `AWS_REGION` | Same region as the bucket |
| `S3_BUCKET` | Your bucket name |
| `S3_PREFIX` | Optional key prefix, e.g. `prod` |

Keep `.env.production` out of git (it is already ignored) and `chmod 600` it.

## 10. Start the stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml ps          # all services "running"/"healthy"
docker compose -f docker-compose.prod.yml logs -f backend caddy
```

The first start builds the frontend and creates the database from `backend/sql` (this only runs on an empty database). Visit `https://$DOMAIN`. The first load may take a minute while Caddy obtains the certificate.

## 11. Create the first teacher account

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec \
  -e TEACHER_PASSWORD='A-strong-password-1' backend \
  node scripts/create-teacher.js "Admin Name" admin@example.com 1
```

The last argument is the programme id (see the Register page list). Other teachers register themselves using the invite code. Students register without one.

## 12. Sample content and verification

`backend/sql/002_seed.sql` inserts demo rows pointing at `/models/anatomy/scene.glb` and `/videos/s.mp4`. Either delete those rows from the app or copy the files into the bucket at the same paths (add your prefix if you set one):

```bash
aws s3 cp anatolearn/public/videos/s.mp4 s3://$BUCKET/PREFIX/videos/s.mp4
aws s3 cp YOUR_MODEL.glb s3://$BUCKET/PREFIX/models/anatomy/scene.glb
```

To migrate files from an older local deployment, sync its folders keeping the same paths:

```bash
for d in models videos captions resources thumbnails; do
  aws s3 sync public/$d s3://$BUCKET/PREFIX/$d
done
```

Smoke test:
1. `curl -s https://$DOMAIN/api/health` returns `{"status":"ok"}`.
2. Log in as the teacher, upload a model, a video (with a `.vtt` caption) and a resource.
3. Confirm the objects appear: `aws s3 ls s3://$BUCKET/PREFIX/ --recursive`.
4. Register a student, confirm they only see published content for their programme, that video seeking works, and that an unauthenticated request to a file URL (`curl -I https://$DOMAIN/videos/FILE.mp4`) returns 401.

## 13. Backups

- **Files:** S3 versioning (step 2) protects against accidental deletes. Optionally add a lifecycle rule to expire old versions after 30-90 days.
- **Database:** schedule a nightly dump to S3 (add `s3:PutObject` for the `backups/` prefix, which the policy above already allows):

```bash
sudo tee /etc/cron.d/anatolearn-backup <<'EOF'
0 3 * * * ubuntu cd /home/ubuntu/itp-team-12/anatolearn && docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres pg_dump -U anatolearn -Fc anatolearn | docker run --rm -i -e AWS_REGION amazon/aws-cli s3 cp - s3://BUCKET/backups/db-$(date +\%F).dump
EOF
```

  The aws-cli container uses the same instance role (hop limit 2). Test one restore with `pg_restore` before relying on it. For managed backups and point-in-time recovery, consider RDS for PostgreSQL instead of the container (change `DATABASE_URL` and remove the `postgres` service).
- Also snapshot the EC2 volume or keep `.env.production` somewhere safe; losing `JWT_SECRET` only logs users out, but losing the database password is a lockout.

## Updating the site

```bash
cd itp-team-12/anatolearn
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Database schema files only run on an empty database. For schema changes on a live database, apply the new SQL file manually:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres psql -U anatolearn -d anatolearn < backend/sql/NEW_FILE.sql
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Compose says a variable is required | A value is missing from `.env.production`; compose names which one |
| Backend exits: `JWT_SECRET must be set...` | Secret missing or under 32 characters |
| Backend exits: `FRONTEND_ORIGINS must list...` | Set it to `https://your-domain` |
| Uploads or file views fail with `Could not load credentials` | Instance profile not attached, or hop limit not 2 (step 6); recheck with `aws ec2 describe-instances --query 'Reservations[].Instances[].MetadataOptions'` |
| `AccessDenied` from S3 | Policy bucket name or prefix does not match `S3_BUCKET`; region mismatch |
| Browser shows certificate error | DNS not yet pointing at the Elastic IP, or ports 80/443 blocked; see `docker compose logs caddy` |
| Login works but you are logged out immediately / 403 "Untrusted request origin" | `FRONTEND_ORIGINS` does not exactly match the browser origin (scheme, host, no trailing slash) |
| 429 Too many requests | Rate limits (10 logins / 15 min per IP). If every user is limited together, `TRUST_PROXY` does not match the proxy chain (default 2: Caddy + nginx) |
| Large upload fails | nginx allows 210 MB; Caddy has no default limit; check backend logs |
| Seed content shows broken | Seed files are not in the bucket (step 12) |

## Security notes

- Rotate `JWT_SECRET` or the invite code by editing `.env.production` and re-running `up -d` (rotating the JWT secret logs everyone out).
- Keep SSH restricted to your IP, apply OS updates regularly (`unattended-upgrades`), and use IMDSv2 (`--http-tokens required`, set in step 6).
- Never open the database port. Keep the bucket private.

## Local development

`docker-compose.yml` is dev-only (Vite dev server, local disk storage, ports bound to 127.0.0.1). Without `STORAGE_DRIVER=s3` the API stores files under `PUBLIC_DIR` on disk. Do not expose the dev stack publicly.

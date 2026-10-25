#!/usr/bin/env bash
# Creates CloudWatch alarms for the AnatoLearn EC2 instance and a public uptime check.
#   INSTANCE_ID=i-0123 ALERT_EMAIL=you@example.com DOMAIN=anatolearn.example.com AWS_REGION=ap-southeast-1 ./setup-alarms.sh
# Requires: aws cli with permission for SNS, CloudWatch and Route 53.
set -euo pipefail
: "${INSTANCE_ID:?}" "${ALERT_EMAIL:?}" "${DOMAIN:?}" "${AWS_REGION:?}"
LOG_GROUP="${LOG_GROUP:-/anatolearn/production}"
export AWS_DEFAULT_REGION="$AWS_REGION"

topic_arn=$(aws sns create-topic --name anatolearn-alerts --query TopicArn --output text)
aws sns subscribe --topic-arn "$topic_arn" --protocol email --notification-endpoint "$ALERT_EMAIL" >/dev/null
echo "Confirm the subscription email sent to $ALERT_EMAIL"

alarm() { aws cloudwatch put-metric-alarm --alarm-name "anatolearn-$1" --alarm-actions "$topic_arn" --ok-actions "$topic_arn" "${@:2}"; }

alarm status-check --namespace AWS/EC2 --metric-name StatusCheckFailed --dimensions Name=InstanceId,Value="$INSTANCE_ID" \
  --statistic Maximum --period 60 --evaluation-periods 2 --threshold 1 --comparison-operator GreaterThanOrEqualToThreshold
alarm cpu-high --namespace AWS/EC2 --metric-name CPUUtilization --dimensions Name=InstanceId,Value="$INSTANCE_ID" \
  --statistic Average --period 300 --evaluation-periods 3 --threshold 85 --comparison-operator GreaterThanThreshold
# These two need the CloudWatch agent (ops/cloudwatch/amazon-cloudwatch-agent.json)
alarm disk-high --namespace AnatoLearn --metric-name disk_used_percent --dimensions Name=InstanceId,Value="$INSTANCE_ID" Name=path,Value=/ Name=device,Value=nvme0n1p1 Name=fstype,Value=ext4 \
  --statistic Maximum --period 300 --evaluation-periods 1 --threshold 80 --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching
alarm memory-high --namespace AnatoLearn --metric-name mem_used_percent --dimensions Name=InstanceId,Value="$INSTANCE_ID" \
  --statistic Average --period 300 --evaluation-periods 3 --threshold 90 --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching

# Application errors: every request or failure logged at level "error" (needs docker-compose.cloudwatch.yml)
aws logs put-retention-policy --log-group-name "$LOG_GROUP" --retention-in-days 90 2>/dev/null || true
aws logs put-metric-filter --log-group-name "$LOG_GROUP" --filter-name app-errors \
  --filter-pattern '{ $.level = "error" }' --metric-transformations metricName=AppErrors,metricNamespace=AnatoLearn,metricValue=1,defaultValue=0 2>/dev/null || \
  echo "Log group $LOG_GROUP does not exist yet; start the stack with docker-compose.cloudwatch.yml and re-run."
alarm app-errors --namespace AnatoLearn --metric-name AppErrors --statistic Sum --period 300 --evaluation-periods 1 \
  --threshold 5 --comparison-operator GreaterThanOrEqualToThreshold --treat-missing-data notBreaching

# Security events. The API logs one {"msg":"security_event","action":...} line for each failed sign-in, MFA failure, lockout,
# recovery-code use and MFA reset (see backend/src/audit.js). Lines hold ids and IPs only. Tune the thresholds to your user base.
#   event_alarm <name> <metric> <period seconds> <threshold> <description> '<action>' ['<action>' ...]
event_alarm() {
  local name="$1" metric="$2" period="$3" threshold="$4" description="$5"; shift 5
  local pattern="" action
  for action in "$@"; do pattern="${pattern:+$pattern || }($.action = \"$action\")"; done
  aws logs put-metric-filter --log-group-name "$LOG_GROUP" --filter-name "$name" \
    --filter-pattern "{ ($.msg = \"security_event\") && ($pattern) }" \
    --metric-transformations metricName="$metric",metricNamespace=AnatoLearn,metricValue=1,defaultValue=0 2>/dev/null || return 0
  alarm "$name" --alarm-description "$description" --namespace AnatoLearn --metric-name "$metric" --statistic Sum --period "$period" \
    --evaluation-periods 1 --threshold "$threshold" --comparison-operator GreaterThanOrEqualToThreshold --treat-missing-data notBreaching
}
event_alarm mfa-failures MfaFailures 300 5 "5 or more wrong two-factor codes in 5 minutes: someone may have a staff password" auth.mfa_failed
event_alarm account-lockouts AccountLockouts 900 3 "3 or more accounts locked in 15 minutes: password guessing in progress" auth.account_locked
event_alarm login-failures LoginFailures 300 25 "25 or more failed sign-ins in 5 minutes: credential stuffing or a broken client" auth.login_failed
event_alarm mfa-reset MfaReset 300 1 "Two-factor authentication was reset or turned off for an account: confirm it was intended" user.reset_mfa profile.mfa_disabled
event_alarm mfa-recovery-used MfaRecoveryUsed 300 1 "A two-factor recovery code was used to sign in: confirm it was the account owner" auth.mfa_recovery_used
event_alarm password-reset PasswordReset 300 1 "An administrator reset a user's password: confirm it was intended" user.reset_password

# Backup freshness: the backup container logs {"msg":"backup ok"} once per run
aws logs put-metric-filter --log-group-name "$LOG_GROUP" --filter-name backup-ok \
  --filter-pattern '{ $.msg = "backup ok" }' --metric-transformations metricName=BackupOk,metricNamespace=AnatoLearn,metricValue=1,defaultValue=0 2>/dev/null || true
alarm backup-missing --namespace AnatoLearn --metric-name BackupOk --statistic Sum --period 86400 --evaluation-periods 1 \
  --threshold 1 --comparison-operator LessThanThreshold --treat-missing-data breaching

# Public uptime check (Route 53 health checks run from several regions; alarms live in us-east-1)
check_id=$(aws route53 create-health-check --caller-reference "anatolearn-$(date +%s)" --health-check-config \
  "Type=HTTPS,FullyQualifiedDomainName=$DOMAIN,Port=443,ResourcePath=/api/health,RequestInterval=30,FailureThreshold=3,EnableSNI=true" \
  --query HealthCheck.Id --output text)
aws route53 change-tags-for-resource --resource-type healthcheck --resource-id "$check_id" --add-tags Key=Name,Value=anatolearn
us_topic=$(aws sns create-topic --region us-east-1 --name anatolearn-alerts --query TopicArn --output text)
aws sns subscribe --region us-east-1 --topic-arn "$us_topic" --protocol email --notification-endpoint "$ALERT_EMAIL" >/dev/null
aws cloudwatch put-metric-alarm --region us-east-1 --alarm-name anatolearn-site-down --namespace AWS/Route53 --metric-name HealthCheckStatus \
  --dimensions Name=HealthCheckId,Value="$check_id" --statistic Minimum --period 60 --evaluation-periods 2 --threshold 1 \
  --comparison-operator LessThanThreshold --alarm-actions "$us_topic" --ok-actions "$us_topic"
echo "Done. Confirm both SNS subscription emails (one per region)."

FROM alpine:3.20
RUN apk add --no-cache postgresql16-client aws-cli tzdata
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh && adduser -D backup
USER backup
HEALTHCHECK --interval=5m --timeout=10s --start-period=15m CMD test -n "$(find /tmp/last-backup-ok -mmin -$(( ${BACKUP_INTERVAL_HOURS:-24} * 60 * 2 )) 2>/dev/null)" || exit 1
CMD ["backup.sh"]

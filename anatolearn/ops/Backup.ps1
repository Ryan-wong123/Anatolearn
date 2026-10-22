param([switch]$VerifyRestore)
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    $snapshotName = 'snapshot-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
    $backendWasRunning = (docker compose ps --status running --services) -contains 'backend'
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect Docker services' }
    try {
        if ($backendWasRunning) {
            docker compose stop backend
            if ($LASTEXITCODE -ne 0) { throw 'Cannot pause backend writes' }
        }
        docker compose --profile ops run --rm --no-deps operations bash /ops/snapshot.sh backup $snapshotName
        if ($LASTEXITCODE -ne 0) { throw 'Backup failed; preserve output for diagnosis' }
    } finally {
        if ($backendWasRunning) {
            docker compose start backend
            if ($LASTEXITCODE -ne 0) { throw 'Backend restart failed; run docker compose start backend' }
        }
    }
    if ($VerifyRestore) {
        docker compose --profile ops run --rm --no-deps operations bash /ops/snapshot.sh verify $snapshotName
        if ($LASTEXITCODE -ne 0) { throw 'Isolated restore verification failed' }
    }
    Write-Output "Backup: backups/$snapshotName"
} finally { Pop-Location }

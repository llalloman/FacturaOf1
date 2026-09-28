$ErrorActionPreference = 'Stop'

function Assert-NativeSuccess([string]$step) {
    if ($LASTEXITCODE -ne 0) {
        throw "$step fallo con exit code $LASTEXITCODE."
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$webAdmin = Join-Path $repoRoot 'web-admin'
$posClient = Join-Path $repoRoot 'pos-client'

Write-Host '== web-admin tests ==' -ForegroundColor Cyan
Push-Location $webAdmin
try {
    npm run test -- --run
    Assert-NativeSuccess 'Pruebas web-admin'
    Write-Host '== web-admin production build ==' -ForegroundColor Cyan
    npm run build
    Assert-NativeSuccess 'Build web-admin'
}
finally {
    Pop-Location
}

Write-Host '== POS production build ==' -ForegroundColor Cyan
Push-Location $posClient
try {
    npm run build
    Assert-NativeSuccess 'Build POS'
}
finally {
    Pop-Location
}

$composeFiles = @(
    'deployments/facturaof1-web/docker-compose.yml',
    'deployments/of1-admin-web/docker-compose.yml',
    'deployments/firmador-web/docker-compose.yml'
)

foreach ($relativePath in $composeFiles) {
    $composePath = Join-Path $repoRoot $relativePath
    Write-Host "== compose config: $relativePath ==" -ForegroundColor Cyan
    docker compose -f $composePath config | Out-Null
    Assert-NativeSuccess "Compose config $relativePath"
}

Write-Host 'Independent products verification completed.' -ForegroundColor Green

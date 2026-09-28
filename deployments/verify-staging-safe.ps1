param(
    [switch]$RunIntegrationTests,
    [switch]$RunFiscalAudit,
    [string]$Of1Ruc = ''
)

$ErrorActionPreference = 'Stop'

function Assert-NativeSuccess([string]$step) {
    if ($LASTEXITCODE -ne 0) {
        throw "$step fallo con exit code $LASTEXITCODE."
    }
}
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root 'venv\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $python)) {
    throw "No se encontro el interprete esperado: $python"
}

# Este runner solo acepta una configuracion de staging explicitamente segura.
# No carga .env ni intenta descubrir credenciales productivas.
$debug = [string]$env:DEBUG
$sri = ([string]$env:SRI_AMBIENTE).Trim().ToUpperInvariant()
$databaseUrl = ([string]$env:DATABASE_URL).Trim().ToLowerInvariant()
$testDb = ([string]$env:DJANGO_TEST_DB_NAME).Trim().ToLowerInvariant()
$stagingApproved = ([string]$env:STAGING_DATABASE_APPROVED).Trim().ToLowerInvariant()

if ($debug -notin @('1', 'true', 'yes')) {
    throw 'Staging requiere DEBUG=True; se rechazo la configuracion actual.'
}
if ($sri -ne 'PRUEBAS') {
    throw 'Staging requiere SRI_AMBIENTE=PRUEBAS; no se permite ejecutar este runner en PRODUCCION.'
}
if ([string]::IsNullOrWhiteSpace($testDb)) {
    throw 'Defina DJANGO_TEST_DB_NAME con una base temporal exclusiva de staging.'
}
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    throw 'Defina DATABASE_URL apuntando explícitamente a la base de staging.'
}
if ($stagingApproved -ne 'true') {
    throw 'Defina STAGING_DATABASE_APPROVED=true como confirmación explícita de la base de staging.'
}
if ($RunFiscalAudit -and [string]::IsNullOrWhiteSpace($Of1Ruc)) {
    throw 'Use -Of1Ruc con el RUC propio de OF1 Solutions para la auditoría read-only.'
}
if ($testDb -match 'prod|production|neon|facturacion_sri$') {
    throw 'DJANGO_TEST_DB_NAME parece productivo; use un nombre temporal de staging.'
}
if ($databaseUrl -match 'neon\.tech|prod|production') {
    throw 'DATABASE_URL parece apuntar a produccion; el runner fue detenido.'
}

Push-Location $root
try {
    Write-Host '== staging: system check ==' -ForegroundColor Cyan
    & $python manage.py check
    Assert-NativeSuccess 'Staging system check'

    Write-Host '== staging: migration drift ==' -ForegroundColor Cyan
    & $python manage.py makemigrations --check --dry-run
    Assert-NativeSuccess 'Staging migration drift check'

    Write-Host '== staging: runtime schema drift ==' -ForegroundColor Cyan
    & $python manage.py audit_runtime_schema --fail-on-drift
    Assert-NativeSuccess 'Staging runtime schema drift check'

    if ($RunIntegrationTests) {
        Write-Host "== staging: Django tests en base temporal '$testDb' ==" -ForegroundColor Cyan
        & $python manage.py test `
            apps.core `
            apps.empresas `
            apps.usuarios `
            apps.facturacion `
            apps.inventarios `
            apps.ventas `
            apps.automation `
            apps.firmas `
            apps.pagos `
            --noinput
        Assert-NativeSuccess 'Staging integration tests'
    }

    if ($RunFiscalAudit) {
        Write-Host '== staging: auditoria fiscal read-only ==' -ForegroundColor Cyan
        & $python manage.py audit_fiscal_context --limit 50 --fail-on-inconsistency
        Assert-NativeSuccess 'Fiscal context audit'
        & $python manage.py audit_of1_tenant --ruc $Of1Ruc
        Assert-NativeSuccess 'OF1 tenant audit'
    }
}
finally {
    Pop-Location
}

Write-Host 'Staging verification completed. No migration, backfill or production write was executed.' -ForegroundColor Green

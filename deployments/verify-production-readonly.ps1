param(
    [Parameter(Mandatory = $true)]
    [string]$Of1Ruc,
    [switch]$RunFiscalAudit
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root 'venv\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $python)) {
    throw "No se encontro el interprete esperado: $python"
}
if ([string]::IsNullOrWhiteSpace($Of1Ruc)) {
    throw 'Debe indicar el RUC propio de OF1 Solutions.'
}

Push-Location $root
try {
    Write-Host '== production read-only: runtime schema ==' -ForegroundColor Cyan
    & $python manage.py audit_runtime_schema
    if ($LASTEXITCODE -ne 0) { throw 'La auditoria de esquema fallo.' }

    Write-Host '== production read-only: OF1 tenant plan ==' -ForegroundColor Cyan
    & $python manage.py audit_of1_tenant --ruc $Of1Ruc --plan
    if ($LASTEXITCODE -ne 0) { throw 'La auditoria de OF1 Solutions fallo.' }

    if ($RunFiscalAudit) {
        Write-Host '== production read-only: fiscal context ==' -ForegroundColor Cyan
        & $python manage.py audit_fiscal_context --limit 50 --fail-on-inconsistency
        if ($LASTEXITCODE -ne 0) { throw 'La auditoria fiscal read-only encontro inconsistencias.' }
    }
}
finally {
    Pop-Location
}

Write-Host 'Production read-only audit completed. No migration, backfill or write was executed.' -ForegroundColor Green

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

Write-Host '== Django system check =='
& $python (Join-Path $root 'manage.py') check
Assert-NativeSuccess 'Django system check'

Write-Host '== Migration drift check =='
& $python (Join-Path $root 'manage.py') makemigrations --check --dry-run
Assert-NativeSuccess 'Migration drift check'

Write-Host '== Python compilation =='
$pythonFiles = @(
  'apps\automation\models.py',
  'apps\automation\serializers.py',
  'apps\automation\views.py',
  'apps\facturacion\management\commands\audit_fiscal_context.py',
  'apps\core\management\commands\audit_runtime_schema.py',
  'apps\empresas\management\commands\audit_of1_tenant.py',
  'apps\facturacion\services\factura_service.py',
  'apps\firmador\views.py',
  'apps\inventarios\models.py',
  'apps\inventarios\serializers.py',
  'apps\inventarios\validation.py',
  'apps\inventarios\views.py',
  'apps\proveedores\models.py',
  'apps\proveedores\serializers.py',
  'apps\proveedores\views.py',
  'apps\usuarios\views.py',
  'apps\ventas\inventory.py',
  'apps\ventas\tests_transaccionalidad.py'
) | ForEach-Object { Join-Path $root $_ }
& $python -m py_compile $pythonFiles
Assert-NativeSuccess 'Python compilation'

Write-Host '== Database-free unit tests =='
$env:DJANGO_SETTINGS_MODULE = 'config.settings'
& $python -m unittest `
  apps.core.tests_permissions_unit `
  apps.core.tests_tenant_unit `
  apps.facturacion.tests_pricing `
  apps.inventarios.tests_valuation `
  apps.empresas.tests_tenant_command_unit `
  apps.automation.tests_dispatcher_unit
if ($LASTEXITCODE -ne 0) {
  throw "Database-free unit tests failed with exit code $LASTEXITCODE."
}

Write-Host 'Backend safe verification completed.'
Write-Host 'Django database/integration tests remain a staging gate; this script never creates, drops, or migrates a database.'

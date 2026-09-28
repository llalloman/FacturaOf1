param(
    [Parameter(Mandatory = $true)]
    [string]$ReleasePath
)

$ErrorActionPreference = 'Stop'
$manifestPath = Join-Path $ReleasePath 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "No existe manifest.json en el release: $ReleasePath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
foreach ($target in @('facturaof1', 'of1-admin', 'firmador')) {
    $artifact = $manifest.artifacts.$target
    if ($artifact.target -ne $target) {
        throw "El release declara target invalido para ${target}: $($artifact.target)"
    }
    $entries = @($artifact.files)
    if ($entries.Count -eq 0) {
        throw "El release no contiene entradas para $target."
    }

    $targetRoot = Join-Path $ReleasePath $target
    foreach ($entry in $entries) {
        $file = Join-Path $targetRoot $entry.path
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            throw "Falta el archivo retenido: $file"
        }
        $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
        if ($hash -ne $entry.sha256) {
            throw "Hash invalido para $file"
        }
    }
}

Write-Host "Frontend release verified: $ReleasePath" -ForegroundColor Green

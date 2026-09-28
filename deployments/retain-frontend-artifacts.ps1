param(
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot,
    [Parameter(Mandatory = $true)]
    [string]$DestinationRoot,
    [Parameter(Mandatory = $true)]
    [string]$ReleaseId
)

$ErrorActionPreference = 'Stop'

if ($ReleaseId -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$') {
    throw 'ReleaseId invalido; use un identificador estable y no ambiguo.'
}

$targets = @('facturaof1', 'of1-admin', 'firmador')
$releasePath = Join-Path (Resolve-Path -LiteralPath $DestinationRoot) $ReleaseId
if (Test-Path -LiteralPath $releasePath) {
    throw "El release ya existe y no se sobrescribira: $releasePath"
}

foreach ($target in $targets) {
    $source = Join-Path $SourceRoot $target
    if (-not (Test-Path -LiteralPath (Join-Path $source 'index.html'))) {
        throw "Falta el artefacto $target en $source"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $source 'build-info.json'))) {
        throw "Falta build-info.json para $target en $source"
    }
}

New-Item -ItemType Directory -Path $releasePath -Force | Out-Null
$manifest = [ordered]@{
    releaseId = $ReleaseId
    createdAtUtc = [DateTime]::UtcNow.ToString('o')
    artifacts = [ordered]@{}
}

foreach ($target in $targets) {
    $source = Join-Path $SourceRoot $target
    $destination = Join-Path $releasePath $target
    Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
    $buildInfo = Get-Content -LiteralPath (Join-Path $destination 'build-info.json') -Raw | ConvertFrom-Json
    if ($buildInfo.target -ne $target) {
        throw "El artefacto $target declara target inesperado: $($buildInfo.target)"
    }
    $files = Get-ChildItem -LiteralPath $destination -Recurse -File | ForEach-Object {
        [ordered]@{
            path = $_.FullName.Substring($destination.Length).TrimStart('\', '/')
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
            bytes = $_.Length
        }
    }
    $manifest.artifacts[$target] = [ordered]@{
        target = $buildInfo.target
        apiUrl = $buildInfo.apiUrl
        files = @($files)
    }
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $releasePath 'manifest.json') -Encoding UTF8
Write-Host "Frontend rollback artifacts retained at $releasePath" -ForegroundColor Green

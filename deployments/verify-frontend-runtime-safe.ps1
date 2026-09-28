param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl,
    [Parameter(Mandatory = $true)]
    [string[]]$FrontendUrls,
    [switch]$StagingApproved
)

$ErrorActionPreference = 'Stop'

if (-not $StagingApproved) {
    throw 'La verificación runtime requiere -StagingApproved explícito.'
}

$api = $ApiBaseUrl.TrimEnd('/')
if ($api -match 'neon\.tech|prod|production') {
    throw 'La URL de API parece productiva; se rechazó la verificación.'
}

Write-Host "== API health: $api/api/health/ ==" -ForegroundColor Cyan
$health = Invoke-RestMethod -Method Get -Uri "$api/api/health/"
if ($health.status -ne 'ok') {
    throw 'La API de staging no devolvió status=ok.'
}

foreach ($frontendUrl in $FrontendUrls) {
    $url = $frontendUrl.TrimEnd('/') + '/'
    Write-Host "== frontend artifact: $url ==" -ForegroundColor Cyan
    $response = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $url
    if ($response.StatusCode -ne 200) {
        throw "El frontend $url devolvió HTTP $($response.StatusCode)."
    }

    $html = [string]$response.Content
    if ([string]::IsNullOrWhiteSpace($html) -or $html -notmatch '<script') {
        throw "El frontend $url no devolvió un index HTML ejecutable."
    }
}

Write-Host 'Frontend runtime verification completed against the approved staging API.' -ForegroundColor Green

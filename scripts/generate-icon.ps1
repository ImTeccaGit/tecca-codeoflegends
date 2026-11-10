# Rigenera tutte le icone dell'app dal logo usato nell'interfaccia.
#
# Sorgente: src-tauri/icons/logo.svg (stesso disegno di
# src/components/brand/logo-mark.tsx, con i colori dei token risolti).
# 1. Microsoft Edge in modalità headless rasterizza l'SVG in un PNG 1024x1024
#    con sfondo trasparente (src-tauri/icons/source.png).
# 2. `tauri icon` genera icon.ico, icon.icns e tutti i PNG richiesti.
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts/generate-icon.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$icons = Join-Path $root "src-tauri\icons"
$svg = Join-Path $icons "logo.svg"
$png = Join-Path $icons "source.png"

$edge = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Microsoft Edge non trovato: serve per rasterizzare logo.svg." }

$page = Join-Path $env:TEMP "tecca-icon-render.html"
$markup = Get-Content -LiteralPath $svg -Raw -Encoding UTF8
@"
<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent;overflow:hidden}
svg{display:block;width:1024px;height:1024px}
</style></head><body>$markup</body></html>
"@ | Set-Content -LiteralPath $page -Encoding UTF8

if (Test-Path $png) { Remove-Item -LiteralPath $png }
$profile = Join-Path $env:TEMP "tecca-icon-edge-profile"
& $edge --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
    --default-background-color=00000000 --window-size=1024,1024 `
    --user-data-dir="$profile" --screenshot="$png" "file:///$($page -replace '\\','/')" | Out-Null

$deadline = (Get-Date).AddSeconds(30)
while (-not (Test-Path $png) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 300 }
if (-not (Test-Path $png)) { throw "Rendering del logo non riuscito." }
Remove-Item -LiteralPath $page -ErrorAction SilentlyContinue

Push-Location $root
try {
    & npx.cmd tauri icon $png
    if ($LASTEXITCODE -ne 0) { throw "tauri icon non riuscito ($LASTEXITCODE)." }
} finally {
    Pop-Location
}
Write-Host "Icone rigenerate da $svg"

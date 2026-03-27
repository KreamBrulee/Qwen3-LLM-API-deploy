param(
    [string]$VenvPath = ".\\.venv",
    [string]$Host = "127.0.0.1",
    [int]$Port = 8001
)

$activateScript = Join-Path $VenvPath "Scripts\\Activate.ps1"
if (-not (Test-Path $activateScript)) {
    throw "Virtual environment not found. Create it with: py -3 -m venv .venv"
}

. $activateScript

if (Test-Path ".\\.env") {
    Write-Host "Loading .env from workspace root"
}

Write-Host "Starting proxy on $Host:$Port"
python -m uvicorn api.proxy.main:app --host $Host --port $Port

param(
    [ValidateSet("init", "validate", "start-local", "start-public", "smoke", "package")]
    [string]$Action = "validate",
    [string]$SettingsFile = "./deploy/deploy.settings.json"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot ".." )).Path
Set-Location $root

function Write-Step {
    param([string]$Message)
    Write-Host "[deploy-framework] $Message"
}

function Get-Settings {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Settings file not found: $Path. Copy deploy/deploy.settings.example.json to deploy/deploy.settings.json first."
    }

    $json = Get-Content $Path -Raw
    return $json | ConvertFrom-Json
}

function Ensure-EnvFile {
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
        Write-Step "Created .env from .env.example"
    }
}

function Initialize-Project {
    Write-Step "Initializing Python environment and dependencies"

    if (-not (Test-Path ".venv")) {
        py -3 -m venv .venv
    }

    & "$root/.venv/Scripts/python.exe" -m pip install --upgrade pip
    & "$root/.venv/Scripts/python.exe" -m pip install -r "$root/requirements.txt"

    Ensure-EnvFile
}

function Validate-Project {
    param($Settings)

    Write-Step "Validating runtime requirements"

    if (-not (Test-Path $Settings.modelPath)) {
        throw "Model file does not exist: $($Settings.modelPath)"
    }

    if (-not (Test-Path $Settings.llamaServerPath)) {
        throw "llama-server binary not found: $($Settings.llamaServerPath)"
    }

    if (-not (Test-Path ".env")) {
        throw ".env missing. Create it from .env.example"
    }

    $envLines = Get-Content ".env"
    $apiKeysLine = $envLines | Where-Object { $_ -match "^API_KEYS=" } | Select-Object -First 1
    if (-not $apiKeysLine -or $apiKeysLine -match "replace-with-strong-key") {
        throw "API_KEYS is not configured in .env"
    }

    if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
        Write-Warning "cloudflared command not found in PATH. Public tunnel action will fail until installed."
    }

    Write-Step "Validation passed"
}

function Start-Window {
    param([string]$Title, [string]$Command)

    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoExit",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$Title'; $Command"
    ) | Out-Null
}

function Start-LocalStack {
    param($Settings)

    Write-Step "Starting llama-server and proxy in separate terminals"

    $llamaCmd = "Set-Location '$root'; .\scripts\start-llama-server.ps1 -ModelPath '$($Settings.modelPath)' -Port $($Settings.llamaPort) -LlamaServerPath '$($Settings.llamaServerPath)'"
    $proxyCmd = "Set-Location '$root'; .\scripts\start-proxy.ps1 -Port $($Settings.proxyPort)"

    Start-Window -Title "LLM Llama Server" -Command $llamaCmd
    Start-Window -Title "LLM Proxy API" -Command $proxyCmd
}

function Start-PublicStack {
    param($Settings)

    Start-LocalStack -Settings $Settings

    Write-Step "Starting cloudflared tunnel in a third terminal"
    $tunnelCmd = "Set-Location '$root'; .\scripts\start-cloudflared.ps1 -TunnelName '$($Settings.tunnelName)'"
    Start-Window -Title "LLM Cloudflare Tunnel" -Command $tunnelCmd
}

function Invoke-SmokeTest {
    param($Settings)

    Write-Step "Running local smoke tests"

    $envLines = Get-Content ".env"
    $apiKeysLine = $envLines | Where-Object { $_ -match "^API_KEYS=" } | Select-Object -First 1
    if (-not $apiKeysLine) {
        throw "API_KEYS line missing in .env"
    }

    $firstKey = ($apiKeysLine -replace "^API_KEYS=", "").Split(",")[0].Trim()
    if ([string]::IsNullOrWhiteSpace($firstKey)) {
        throw "No usable API key found in .env"
    }

    $headers = @{ Authorization = "Bearer $firstKey" }
    $health = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$($Settings.proxyPort)/healthz"
    $models = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$($Settings.proxyPort)/v1/models" -Headers $headers

    Write-Step "Health: $($health.status)"
    if ($models.data) {
        Write-Step "Model count: $($models.data.Count)"
    } else {
        Write-Step "Models endpoint reachable"
    }
}

function New-ReleaseBundle {
    param($Settings)

    Write-Step "Creating deployment bundle"

    $outDir = Join-Path $root "out"
    if (-not (Test-Path $outDir)) {
        New-Item -ItemType Directory -Path $outDir | Out-Null
    }

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $bundlePath = Join-Path $outDir "llm-deploy-bundle-$stamp.zip"

    $includePaths = @(
        "api",
        "scripts",
        "cloudflare",
        "deploy",
        "docs",
        "requirements.txt",
        ".env.example",
        "README.md",
        ".gitignore"
    ) | ForEach-Object { Join-Path $root $_ }

    Compress-Archive -Path $includePaths -DestinationPath $bundlePath -Force
    Write-Step "Bundle created: $bundlePath"
}

$settings = Get-Settings -Path $SettingsFile

switch ($Action) {
    "init" { Initialize-Project }
    "validate" { Validate-Project -Settings $settings }
    "start-local" {
        Validate-Project -Settings $settings
        Start-LocalStack -Settings $settings
    }
    "start-public" {
        Validate-Project -Settings $settings
        Start-PublicStack -Settings $settings
    }
    "smoke" { Invoke-SmokeTest -Settings $settings }
    "package" { New-ReleaseBundle -Settings $settings }
}

Write-Step "Action complete: $Action"

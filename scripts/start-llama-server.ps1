param(
    [Parameter(Mandatory = $true)]
    [string]$ModelPath,

    [int]$Port = 8080,
    [int]$GpuLayers = 999,
    [int]$ContextSize = 4096,
    [int]$Threads = 8,
    [int]$BatchSize = 512,
    [string]$LlamaServerPath = ".\\E:\\llm\\bin\\llama-server.exe"
)

if (-not (Test-Path $ModelPath)) {
    throw "Model file not found: $ModelPath"
}

if (-not (Test-Path $LlamaServerPath)) {
    throw "llama-server binary not found: $LlamaServerPath"
}

$args = @(
    "-m", $ModelPath,
    "--host", "127.0.0.1",
    "--port", "$Port",
    "-ngl", "$GpuLayers",
    "-c", "$ContextSize",
    "-t", "$Threads",
    "-b", "$BatchSize"
)

Write-Host "Starting llama-server on 127.0.0.1:$Port"
& $LlamaServerPath @args

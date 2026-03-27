param(
    [Parameter(Mandatory = $true)]
    [string]$TunnelName,
    [string]$CloudflaredPath = "cloudflared"
)

Write-Host "Starting cloudflared tunnel: $TunnelName"
& $CloudflaredPath tunnel run $TunnelName

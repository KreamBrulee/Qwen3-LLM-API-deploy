param(
    [Parameter(Mandatory = $true)]
    [string]$LlamaCommand,

    [Parameter(Mandatory = $true)]
    [string]$ProxyCommand,

    [Parameter(Mandatory = $true)]
    [string]$TunnelCommand
)

$actionLlama = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command $LlamaCommand"
$actionProxy = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command $ProxyCommand"
$actionTunnel = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command $TunnelCommand"

$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "LLM-LlamaServer" -Action $actionLlama -Trigger $trigger -Principal $principal -Settings $settings -Force
Register-ScheduledTask -TaskName "LLM-Proxy" -Action $actionProxy -Trigger $trigger -Principal $principal -Settings $settings -Force
Register-ScheduledTask -TaskName "LLM-Cloudflared" -Action $actionTunnel -Trigger $trigger -Principal $principal -Settings $settings -Force

Write-Host "Scheduled tasks created: LLM-LlamaServer, LLM-Proxy, LLM-Cloudflared"

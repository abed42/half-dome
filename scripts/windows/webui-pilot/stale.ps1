. C:\pilot\lib.ps1
$ErrorActionPreference = 'Continue'
$results = [ordered]@{}
function Check([string]$name, [bool]$ok, [string]$detail) {
  $results[$name] = @{ ok = $ok; detail = $detail }
  Log ("{0} {1}: {2}" -f ($(if ($ok) { 'PASS' } else { 'FAIL' }), $name, $detail))
}
function ShellLog { @(Get-Content "$Data\Chromium\chrome_debug.log" -ErrorAction SilentlyContinue | Select-String 'WebUI shell' | ForEach-Object { $_.Line.Substring($_.Line.IndexOf('WebUI shell')) }) }
Stop-Engine
Start-Shell -Fresh | Out-Null
Wait-Shell 60 | Out-Null
Start-Sleep -Seconds 10
$late = Cdp-Eval '__ardiaHost.invoke("ArdiaShell.testDelayedReply", { args: [1500] })'
Check 'delayed-reply-control' ($late -eq 'late') "a delayed reply to the live document resolves: '$late'"
Cdp-Eval '__ardiaHost.invoke("tab.create", { key: "stale-probe", claim: "stale-claim", profile: "default", url: "file:///C:/pilot/form.html" }).then(() => "made")' | Out-Null
Start-Sleep -Seconds 2
$before = (ShellLog).Count
Cdp-Eval '(() => { window.__ardiaHost.invoke("ArdiaShell.testDelayedReply", { args: [3000] }); setTimeout(() => location.reload(), 300); return "sent"; })()' | Out-Null
Start-Sleep -Seconds 8
$after = @(ShellLog | Select-Object -Skip $before)
$after | ForEach-Object { Log "log $_" }
$retired = $after | Where-Object { $_ -match 'shell document retired; generation is now (\d+), (\d+) pages of the old document dropped' }
$dropped = $after | Where-Object { $_ -match 'reply dropped: shell document (\d+) is not the live one \((\d+)\)' }
Check 'reload-retires-document' ([bool]$retired) "$retired"
Check 'old-reply-dropped' ([bool]$dropped) "$dropped"
$live = Cdp-Eval '__ardiaHost.invoke("ArdiaShell.windowIdentity", {})'
Check 'new-document-answers' ($live -eq 'main') "the reloaded shell's own call answers: '$live'"
$targets = @(Invoke-RestMethod -TimeoutSec 10 http://127.0.0.1:9222/json/list)
Log ("targets after reload: " + (($targets | ForEach-Object { $_.url }) -join ' | '))
Stop-Engine
$results | ConvertTo-Json -Depth 4 | Set-Content "$Proof\stale-results.json"
"DONE stale"

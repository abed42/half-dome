. C:\pilot\lib.ps1
$ErrorActionPreference = 'Continue'
$results = New-Object System.Collections.Specialized.OrderedDictionary ([StringComparer]::Ordinal)
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
$origin = Cdp-Eval 'String(performance.timeOrigin)'
Cdp-Eval '(() => { window.__ardiaHost.invoke("ArdiaShell.testDelayedReply", { args: [3000] }); return "sent"; })()' | Out-Null
Start-Sleep -Milliseconds 300
Cdp-Command 'Page.crash' @{} -NoReply | Out-Null
Start-Sleep -Seconds 5
Cdp-Command 'Page.reload' @{ ignoreCache = $true } | Out-Null
Start-Sleep -Seconds 10
$after = @(ShellLog | Select-Object -Skip $before)
$after | ForEach-Object { Log "log $_" }
$retired = @($after | Where-Object { $_ -match 'shell document retired; generation is now (\d+), (\d+) pages of the old document dropped' })
$dropped = @($after | Where-Object { $_ -match 'reply dropped: shell document (\d+) is not the live one \((\d+)\)' })
$live = @($after | Where-Object { $_ -match 'shell document (\d+) is live' })
Check 'crash-retires-document' ($retired.Count -ge 1) "$($retired -join ' / ')"
Check 'old-reply-dropped' ($dropped.Count -ge 1) "$($dropped -join ' / ')"
Check 'reload-is-a-new-generation' ($live.Count -ge 1) "$($live -join ' / ')"
$reloaded = Cdp-Eval 'String(performance.timeOrigin)'
$answer = Cdp-Eval '__ardiaHost.invoke("ArdiaShell.windowIdentity", {})'
Check 'new-document-answers' (($answer -eq 'main') -and ($reloaded -ne $origin)) "new document (time origin $origin -> $reloaded) answers '$answer'"
$targets = (Cdp-List)
Log ("targets after reload: " + (($targets | ForEach-Object { $_.url }) -join ' | '))

Start-Sleep -Seconds 5
$before = (ShellLog).Count
Cdp-Eval '(() => { window.__ardiaHost.invoke("tab.create", { key: "orphan-probe", claim: "orphan-claim", profile: "default", url: "file:///C:/pilot/form.html?orphan", testDelayMs: 4000 }); return "asked"; })()' | Out-Null
Start-Sleep -Milliseconds 300
Cdp-Command 'Page.crash' @{} -NoReply | Out-Null
Start-Sleep -Seconds 2
Cdp-Command 'Page.reload' @{ ignoreCache = $true } | Out-Null
Start-Sleep -Seconds 8
$after = @(ShellLog | Select-Object -Skip $before)
$after | ForEach-Object { Log "log $_" }
$orphanDropped = @($after | Where-Object { $_ -match 'page creation dropped( before its profile loaded)?: shell document (\d+) is not the live one' })
$targets = (Cdp-List)
$orphan = @($targets | Where-Object { $_.url -like '*form.html?orphan*' })
Check 'retired-document-makes-no-page' (($orphanDropped.Count -ge 1) -and ($orphan.Count -eq 0)) "$($orphanDropped -join ' / '); targets: $(($targets | ForEach-Object { $_.url }) -join ' | ')"

Start-Sleep -Seconds 5
$before = (ShellLog).Count
$orphanProfile = "$Data\Chromium\Ardia orphanprofile"
Cdp-Eval '(() => { window.__ardiaHost.invoke("tab.create", { key: "orphan-profile-probe", claim: "orphan-profile-claim", profile: "orphanprofile", url: "file:///C:/pilot/form.html?orphanprofile", testDelayMs: 4000 }); return "asked"; })()' | Out-Null
Start-Sleep -Milliseconds 300
Cdp-Command 'Page.crash' @{} -NoReply | Out-Null
Start-Sleep -Seconds 2
Cdp-Command 'Page.reload' @{ ignoreCache = $true } | Out-Null
Start-Sleep -Seconds 8
$after = @(ShellLog | Select-Object -Skip $before)
$after | ForEach-Object { Log "log $_" }
$profileDropped = @($after | Where-Object { $_ -match 'page creation dropped before its profile loaded: shell document (\d+) is not the live one' })
$targets = (Cdp-List)
$orphan = @($targets | Where-Object { $_.url -like '*form.html?orphanprofile*' })
$madeProfile = Test-Path -LiteralPath $orphanProfile
Check 'retired-document-loads-no-profile' (($profileDropped.Count -ge 1) -and ($orphan.Count -eq 0) -and -not $madeProfile) "$($profileDropped -join ' / '); $orphanProfile on disk: $madeProfile"
$alive = Cdp-Eval '__ardiaHost.invoke("tab.create", { key: "after-orphan", claim: "after-orphan-claim", profile: "orphanprofile", url: "file:///C:/pilot/form.html?after" }).then(() => "made", e => "refused " + e)'
Start-Sleep -Seconds 3
Check 'live-document-still-loads-that-profile' (($alive -eq 'made') -and (Test-Path -LiteralPath $orphanProfile)) "the live document's tab.create answered '$alive'; $orphanProfile on disk: $(Test-Path -LiteralPath $orphanProfile)"
Stop-Engine
$results | ConvertTo-Json -Depth 4 | Set-Content "$Proof\stale-results.json"
Remove-PilotRun $RunRoot
"DONE stale"

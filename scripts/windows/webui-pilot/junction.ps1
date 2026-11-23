. C:\pilot\lib.ps1
$ErrorActionPreference = 'Continue'
$results = [ordered]@{}
function Check([string]$name, [bool]$ok, [string]$detail) {
  $results[$name] = @{ ok = $ok; detail = $detail }
  Log ("{0} {1}: {2}" -f ($(if ($ok) { 'PASS' } else { 'FAIL' }), $name, $detail))
}
Stop-Engine
Remove-Item Env:ARDIA_DATA_DIR, Env:ARDIA_REMOTE_DEBUGGING_PORT -ErrorAction SilentlyContinue
$local = [Environment]::GetFolderPath('LocalApplicationData')
$rn = "$local\Ardia"
$web = "$local\Ardia WebUI"
foreach ($existing in @($rn, $web)) {
  if (Test-Path -LiteralPath $existing) {
    Log "refusing to run: $existing already exists on this account, and this check only touches folders it makes"
    "DONE junction refused"
    exit 2
  }
}
function Unlink([string]$path) {
  $item = Get-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
  if (-not $item) { return }
  if ($item.LinkType) { cmd /c rmdir "$path" | Out-Null } elseif ($item.PSIsContainer) { Remove-Item -LiteralPath $path -Recurse -Force } else { Remove-Item -LiteralPath $path -Force }
}
function Snapshot { (Get-ChildItem -Recurse -Force $rn -ErrorAction SilentlyContinue | ForEach-Object { $name = $_.FullName.Substring($rn.Length); if ($_.PSIsContainer) { $name } else { $name + ':' + $_.Length + ':' + $_.LastWriteTimeUtc.Ticks } }) -join "`n" }
function Launch([string]$name, [string[]]$extra = @(), [string]$dataDir = '') {
  $before = Snapshot
  if ($dataDir) { $env:ARDIA_DATA_DIR = $dataDir }
  $p = Start-Process "$App\chrome.exe" -ArgumentList (@('--ardia-shell=webui') + $extra) -PassThru
  Remove-Item Env:ARDIA_DATA_DIR -ErrorAction SilentlyContinue
  $exited = $p.WaitForExit(15000)
  Start-Sleep -Seconds 2
  $window = [Pilot]::FindShell('Ardia') -ne [IntPtr]::Zero
  $code = if ($exited) { $p.ExitCode } else { 'running' }
  $now = Snapshot
  $unchanged = $now -eq $before
  if (-not $unchanged) { Compare-Object ($before -split "`n") ($now -split "`n") | ForEach-Object { Log "changed $($_.SideIndicator) $($_.InputObject)" } }
  Stop-Engine
  Check $name ($exited -and $code -eq 1 -and -not $window -and $unchanged -and ((Engine-Processes).Count -eq 0)) "exit $code, window $window, React Native folder unchanged $unchanged"
}
New-Item -ItemType Directory -Force "$rn\User Data\Default" | Out-Null
Set-Content "$rn\User Data\Default\Preferences" '{"react native profile":true}'
Set-Content "$rn\session.json" '{"react native session":true}'

cmd /c mklink /J "$web" "$rn" | Out-Null
Log "fixture: $((Get-Item $web).LinkType) $web -> $((Get-Item $web).Target)"
Launch 'junction-app-data-to-react-native'
Unlink $web

New-Item -ItemType Directory -Force $web | Out-Null
cmd /c mklink /J "$web\Chromium" "$rn\User Data" | Out-Null
Log "fixture: $((Get-Item "$web\Chromium").LinkType) $web\Chromium -> $((Get-Item "$web\Chromium").Target)"
Launch 'junction-profile-to-react-native'
Unlink "$web\Chromium"
Unlink $web

Launch 'user-data-dir-into-react-native' @("--user-data-dir=$rn\User Data")
Launch 'ardia-data-dir-at-react-native' @() $rn

Set-Content -LiteralPath $web 'not a folder'
Log "fixture: $web is a file, so the WebUI profile can't be created"
Launch 'uncreatable-webui-folder'
Unlink $web

$before = Snapshot
$p = Start-Process "$App\chrome.exe" -ArgumentList '--ardia-shell=webui' -PassThru
$h = $null
try { $h = Wait-Shell 60 } catch {}
Check 'control-no-fixture-starts' (($h -ne $null) -and ($h -ne [IntPtr]::Zero) -and ((Snapshot) -eq $before)) "the same launch with none of these opens the window; React Native folder unchanged $((Snapshot) -eq $before)"
Shot "$Proof\junction-control.png"
Stop-Engine
Start-Sleep -Seconds 1
Unlink $web
Unlink $rn
$results | ConvertTo-Json -Depth 4 | Set-Content "$Proof\junction-results.json"
"DONE junction"

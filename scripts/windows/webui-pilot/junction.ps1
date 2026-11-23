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
function Unlink([string]$path) { if (Test-Path $path) { cmd /c rmdir "$path" | Out-Null; Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue } }
function Snapshot { (Get-ChildItem -Recurse -Force $rn -ErrorAction SilentlyContinue | ForEach-Object { $name = $_.FullName.Substring($rn.Length); if ($_.PSIsContainer) { $name } else { $name + ':' + $_.Length + ':' + $_.LastWriteTimeUtc.Ticks } }) -join "`n" }
function Launch([string]$name) {
  $before = Snapshot
  $p = Start-Process "$App\chrome.exe" -ArgumentList '--ardia-shell=webui' -PassThru
  $exited = $p.WaitForExit(15000)
  $window = [Pilot]::FindShell('Ardia') -ne [IntPtr]::Zero
  $code = if ($exited) { $p.ExitCode } else { 'running' }
  $now = Snapshot
  $unchanged = $now -eq $before
  if (-not $unchanged) { Compare-Object ($before -split "`n") ($now -split "`n") | ForEach-Object { Log "changed $($_.SideIndicator) $($_.InputObject)" } }
  Stop-Engine
  Check $name ($exited -and $code -eq 1 -and -not $window -and $unchanged) "exit $code, window $window, React Native folder unchanged $unchanged"
}
Unlink $web
New-Item -ItemType Directory -Force "$rn\User Data" | Out-Null
Set-Content "$rn\User Data\marker.txt" 'react native profile'
cmd /c mklink /J "$web" "$rn" | Out-Null
Log "junction: $((Get-Item $web).LinkType) $web -> $((Get-Item $web).Target)"
Launch 'junction-app-data-to-react-native'
Unlink $web
New-Item -ItemType Directory -Force $web | Out-Null
cmd /c mklink /J "$web\Chromium" "$rn\User Data" | Out-Null
Log "junction: $((Get-Item "$web\Chromium").LinkType) $web\Chromium -> $((Get-Item "$web\Chromium").Target)"
Launch 'junction-profile-to-react-native'
Unlink "$web\Chromium"
Unlink $web
$p = Start-Process "$App\chrome.exe" -ArgumentList '--ardia-shell=webui' -PassThru
$h = $null
try { $h = Wait-Shell 60 } catch {}
Check 'control-no-junction-starts' ($h -ne $null -and $h -ne [IntPtr]::Zero) "the same launch without a junction opens the window"
Shot "$Proof\junction-control.png"
Stop-Engine
Remove-Item -Recurse -Force $rn -ErrorAction SilentlyContinue
$results | ConvertTo-Json -Depth 4 | Set-Content "$Proof\junction-results.json"
"DONE junction"

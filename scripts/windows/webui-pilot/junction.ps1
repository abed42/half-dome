. C:\pilot\lib.ps1
$ErrorActionPreference = 'Continue'
$results = New-Object System.Collections.Specialized.OrderedDictionary ([StringComparer]::Ordinal)
function Check([string]$name, [bool]$ok, [string]$detail) {
  $results[$name] = @{ ok = $ok; detail = $detail }
  Log ("{0} {1}: {2}" -f ($(if ($ok) { 'PASS' } else { 'FAIL' }), $name, $detail))
}
Stop-Engine
Remove-Item Env:ARDIA_DATA_DIR, Env:ARDIA_REMOTE_DEBUGGING_PORT -ErrorAction SilentlyContinue
$run = New-PilotRun
$local = Join-Path $run 'local'
$roaming = Join-Path $run 'roaming'
$elsewhere = Join-Path $run 'elsewhere'
New-Item -ItemType Directory $local, $roaming, $elsewhere | Out-Null
$rn = Join-Path $local 'Ardia'
$web = Join-Path $local 'Ardia WebUI'
$realLocal = [Environment]::GetFolderPath('LocalApplicationData')
$realBefore = @(Get-ChildItem -Force $realLocal -ErrorAction SilentlyContinue | ForEach-Object Name) -join '|'
Log "run $run; LOCALAPPDATA and APPDATA for every launch point inside it"

function Unlink([string]$path) {
  $item = Get-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
  if (-not $item) { return }
  if ($item.LinkType) { cmd /c rmdir "$path" | Out-Null } elseif ($item.PSIsContainer) { Remove-Item -LiteralPath $path -Recurse -Force } else { Remove-Item -LiteralPath $path -Force }
}
function Junction([string]$link, [string]$target) {
  cmd /c mklink /J "$link" "$target" | Out-Null
  Log "fixture: $link -> $((Get-Item -LiteralPath $link -Force).Target)"
}
function Snapshot { (Get-ChildItem -Recurse -Force $rn, $elsewhere -ErrorAction SilentlyContinue | ForEach-Object { if ($_.PSIsContainer) { $_.FullName } else { $_.FullName + ':' + $_.Length + ':' + $_.LastWriteTimeUtc.Ticks } }) -join "`n" }
function Start-Pilot([string[]]$arguments, [string]$dataDir = '') {
  $saved = @{ LOCALAPPDATA = $env:LOCALAPPDATA; APPDATA = $env:APPDATA }
  $env:LOCALAPPDATA = $local
  $env:APPDATA = $roaming
  if ($dataDir) { $env:ARDIA_DATA_DIR = $dataDir }
  try { Start-Process "$App\chrome.exe" -ArgumentList $arguments -PassThru }
  finally {
    $env:LOCALAPPDATA = $saved.LOCALAPPDATA
    $env:APPDATA = $saved.APPDATA
    Remove-Item Env:ARDIA_DATA_DIR -ErrorAction SilentlyContinue
  }
}
function Refused([string]$name, [string[]]$arguments, [string]$dataDir = '') {
  $before = Snapshot
  $p = Start-Pilot $arguments $dataDir
  $exited = $p.WaitForExit(15000)
  Start-Sleep -Seconds 2
  $window = [Pilot]::FindShell('Ardia') -ne [IntPtr]::Zero
  $code = if ($exited) { $p.ExitCode } else { 'running' }
  $now = Snapshot
  $unchanged = $now -eq $before
  if (-not $unchanged) { Compare-Object ($before -split "`n") ($now -split "`n") | ForEach-Object { Log "changed $($_.SideIndicator) $($_.InputObject)" } }
  Stop-Engine
  Check $name ($exited -and $code -eq 1 -and -not $window -and $unchanged -and ((Engine-Processes).Count -eq 0)) "$($arguments -join ' ')$(if ($dataDir) { " with ARDIA_DATA_DIR=$dataDir" }): exit $code, window $window, React Native folders unchanged $unchanged"
}
function Opens([string]$name, [string[]]$arguments) {
  $before = Snapshot
  $p = Start-Pilot $arguments
  $h = $null
  try { $h = Wait-Shell 60 } catch {}
  Start-Sleep -Seconds 3
  $pinned = $false
  if ($h) {
    try { Rename-Item -LiteralPath $web -NewName 'Ardia WebUI moved' -ErrorAction Stop } catch { $pinned = $true }
    if (-not $pinned) { Rename-Item -LiteralPath (Join-Path $local 'Ardia WebUI moved') -NewName 'Ardia WebUI' }
  }
  $unchanged = (Snapshot) -eq $before
  $inWebUI = Test-Path -LiteralPath (Join-Path $web 'Chromium\Local State')
  Stop-Engine
  Check $name (($h -ne $null) -and ($h -ne [IntPtr]::Zero) -and $unchanged -and $inWebUI -and $pinned) "$($arguments -join ' '): window $(($h -ne $null) -and ($h -ne [IntPtr]::Zero)), profile in Ardia WebUI\Chromium $inWebUI, folder pinned against rename $pinned, React Native folders unchanged $unchanged"
}

New-Item -ItemType Directory -Force "$rn\User Data\Default" | Out-Null
Set-Content "$rn\User Data\Default\Preferences" '{"react native profile":true}'
Set-Content "$rn\session.json" '{"react native session":true}'

Junction $web $rn
Refused 'junction-app-data-to-react-native' @('--ardia-shell=webui')
foreach ($variant in @('--ARDIA-SHELL=webui', '-ardia-shell=webui', '/ardia-shell=webui', '--Ardia-Shell=webui')) {
  Refused "switch-spelling $variant with the junction" @($variant)
}
Unlink $web

New-Item -ItemType Directory $web | Out-Null
Junction (Join-Path $web 'Chromium') "$rn\User Data"
Refused 'junction-profile-to-react-native' @('--ardia-shell=webui')
Unlink (Join-Path $web 'Chromium')
Unlink $web

Refused 'user-data-dir-into-react-native' @('--ardia-shell=webui', "--user-data-dir=$rn\User Data")
Refused 'user-data-dir-spelled-long-path' @('--ardia-shell=webui', "--user-data-dir=\\?\$rn\User Data")
$short = (cmd /c "for %I in (""$rn\User Data"") do @echo %~sI").Trim()
Log "8.3 spelling of the React Native profile: $short"
if ($short -and $short -ne "$rn\User Data") {
  Refused 'user-data-dir-spelled-8.3' @('--ardia-shell=webui', "--user-data-dir=$short")
} else {
  Check 'user-data-dir-spelled-8.3' $false "no 8.3 name was generated for $rn\User Data"
}
$unc = '\\localhost\' + $rn.Substring(0, 1) + '$' + $rn.Substring(2) + '\User Data'
if (Test-Path -LiteralPath $unc) {
  Refused 'user-data-dir-spelled-unc' @('--ardia-shell=webui', "--user-data-dir=$unc")
} else {
  Check 'user-data-dir-spelled-unc' $false "$unc is not reachable"
}
Refused 'ardia-data-dir-at-react-native' @('--ardia-shell=webui') $rn

Set-Content -LiteralPath $web 'not a folder'
Log "fixture: $web is a file, so the WebUI profile can't be created"
Refused 'uncreatable-webui-folder' @('--ardia-shell=webui')
Unlink $web

Rename-Item -LiteralPath "$rn\User Data" -NewName 'User Data moved'
Move-Item -LiteralPath "$rn\User Data moved" -Destination (Join-Path $elsewhere 'profile')
Junction "$rn\User Data" (Join-Path $elsewhere 'profile')
New-Item -ItemType Directory $web | Out-Null
Junction (Join-Path $web 'Chromium') (Join-Path $elsewhere 'profile')
Refused 'relocated-react-native-profile' @('--ardia-shell=webui')
Unlink (Join-Path $web 'Chromium')
Unlink $web

Opens 'control-starts-in-webui-folder' @('--ardia-shell=webui')
Unlink $web
Opens 'control-switch-spelling-uppercase' @('--ARDIA-SHELL=webui')
Unlink $web
Opens 'control-switch-spelling-single-dash' @('-ardia-shell=webui')
Shot "$Proof\junction-control.png"
Unlink $web

$realAfter = @(Get-ChildItem -Force $realLocal -ErrorAction SilentlyContinue | ForEach-Object Name) -join '|'
Check 'account-folders-untouched' ($realAfter -eq $realBefore) "the account's own LOCALAPPDATA lists the same entries before and after"
Remove-PilotRun $run
Check 'run-folder-removed-by-marker' (-not (Test-Path -LiteralPath $run)) "$run removed after its .pilot-run marker matched"
$results | ConvertTo-Json -Depth 4 | Set-Content "$Proof\junction-results.json"
"DONE junction"

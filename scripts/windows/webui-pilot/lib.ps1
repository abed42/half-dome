$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Runtime.InteropServices;
public static class Pilot {
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr extra; }
  [StructLayout(LayoutKind.Explicit)] public struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public UNION u; }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lparam);
  [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc proc, IntPtr lparam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr hwnd, StringBuilder name, int max);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, StringBuilder name, int max);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hwnd, ref POINT p);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hwnd, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out RECT rect, int size);
  public static string AppDir = "";
  public static bool IsPilotProcess(int pid) {
    try { return Process.GetProcessById(pid).MainModule.FileName.StartsWith(AppDir, StringComparison.OrdinalIgnoreCase); } catch { return false; }
  }
  public static void Aware() { SetProcessDpiAwarenessContext(new IntPtr(-4)); }
  static INPUT Mouse(uint flags, int x, int y, uint data) {
    INPUT i = new INPUT(); i.type = 0; i.u.mi.dx = x; i.u.mi.dy = y; i.u.mi.mouseData = data; i.u.mi.dwFlags = flags; return i;
  }
  static INPUT Key(ushort vk, ushort scan, uint flags) {
    INPUT i = new INPUT(); i.type = 1; i.u.ki.wVk = vk; i.u.ki.wScan = scan; i.u.ki.dwFlags = flags; return i;
  }
  static void Send(params INPUT[] inputs) { SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT))); }
  public static void MoveTo(int x, int y) {
    int vx = GetSystemMetrics(76), vy = GetSystemMetrics(77), vw = GetSystemMetrics(78), vh = GetSystemMetrics(79);
    int nx = (int)Math.Round((x - vx) * 65535.0 / (vw - 1)), ny = (int)Math.Round((y - vy) * 65535.0 / (vh - 1));
    Send(Mouse(0x0001 | 0x8000 | 0x4000, nx, ny, 0));
  }
  public static void Glide(int x, int y, int steps, int ms) {
    POINT p; GetCursorPos(out p);
    for (int s = 1; s <= steps; s++) { MoveTo(p.X + (x - p.X) * s / steps, p.Y + (y - p.Y) * s / steps); Thread.Sleep(ms); }
  }
  public static void Down() { Send(Mouse(0x0002, 0, 0, 0)); }
  public static void Up() { Send(Mouse(0x0004, 0, 0, 0)); }
  public static void Click(int x, int y) { Glide(x, y, 12, 12); Thread.Sleep(80); Down(); Thread.Sleep(60); Up(); }
  public static void DoubleClick(int x, int y) { Glide(x, y, 12, 12); Thread.Sleep(80); Down(); Up(); Thread.Sleep(60); Down(); Up(); }
  public static void Drag(int x0, int y0, int x1, int y1, int steps) { Glide(x0, y0, 10, 15); Thread.Sleep(120); Down(); Thread.Sleep(120); Glide(x1, y1, steps, 16); Thread.Sleep(200); Up(); }
  public static void KeyDown(ushort vk) { Send(Key(vk, 0, (vk >= 0x21 && vk <= 0x2E) || vk == 0x5B ? 1u : 0u)); }
  public static void KeyUp(ushort vk) { Send(Key(vk, 0, 2u | ((vk >= 0x21 && vk <= 0x2E) || vk == 0x5B ? 1u : 0u))); }
  public static void Chord(params ushort[] vks) { foreach (var v in vks) { KeyDown(v); Thread.Sleep(30); } Thread.Sleep(60); for (int k = vks.Length - 1; k >= 0; k--) { KeyUp(vks[k]); Thread.Sleep(30); } }
  public static void Type(string text) {
    foreach (char c in text) { Send(Key(0, c, 0x0004), Key(0, c, 0x0004 | 0x0002)); Thread.Sleep(35); }
  }
  static bool IsShell(IntPtr h) {
    if (!IsWindowVisible(h)) return false;
    var c = new StringBuilder(256); GetClassName(h, c, 256);
    if (!c.ToString().StartsWith("Chrome_WidgetWin")) return false;
    uint pid; GetWindowThreadProcessId(h, out pid);
    if (!IsPilotProcess((int)pid)) return false;
    RECT r; GetWindowRect(h, out r);
    return (r.Right - r.Left) > 400 && (r.Bottom - r.Top) > 300;
  }
  public static IntPtr FindShell(string title) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => { if (IsShell(h)) { found = h; return false; } return true; }, IntPtr.Zero);
    return found;
  }
  public static int CountShells(string title) {
    int n = 0;
    EnumWindows((h, l) => { if (IsShell(h)) n++; return true; }, IntPtr.Zero);
    return n;
  }
  public static RECT Frame(IntPtr hwnd) { RECT r; DwmGetWindowAttribute(hwnd, 9, out r, Marshal.SizeOf(typeof(RECT))); return r; }
  public static RECT Outer(IntPtr hwnd) { RECT r; GetWindowRect(hwnd, out r); return r; }
  public static string Hit(int x, int y) {
    POINT p; p.X = x; p.Y = y; IntPtr h = WindowFromPoint(p);
    long l = ((long)(short)y << 16) | (ushort)(short)x;
    IntPtr r = SendMessage(h, 0x0084, IntPtr.Zero, new IntPtr(l));
    var c = new StringBuilder(256); GetClassName(h, c, 256);
    string via = "";
    if (r.ToInt64() == -1) { IntPtr root = GetAncestor(h, 2); via = c.ToString() + ">"; h = root; r = SendMessage(h, 0x0084, IntPtr.Zero, new IntPtr(l)); c = new StringBuilder(256); GetClassName(h, c, 256); }
    return via + c.ToString() + ":" + r.ToInt64();
  }
}
"@
[Pilot]::Aware() | Out-Null

function Shot([string]$path) {
  & C:\tools\ffmpeg.exe -hide_banner -loglevel error -y -f gdigrab -framerate 1 -i desktop -frames:v 1 $path
}

function Shell-Window { [Pilot]::FindShell('Ardia') }

function Wait-Shell([int]$seconds = 60) {
  $end = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $end) {
    $h = Shell-Window
    if ($h -ne [IntPtr]::Zero) { return $h }
    Start-Sleep -Milliseconds 300
  }
  throw "no Ardia WebUI window after $seconds s"
}

function Rect-Text($r) { "$($r.Left),$($r.Top) $($r.Right - $r.Left)x$($r.Bottom - $r.Top)" }

function Cdp-Command([string]$method, $params, [string]$match = 'chrome://ardia/', [switch]$NoReply) {
  $targets = Invoke-RestMethod -TimeoutSec 10 http://127.0.0.1:9222/json/list
  $target = $targets | Where-Object { $_.url -like "$match*" } | Select-Object -First 1
  if (-not $target) { return $null }
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $deadline = New-Object Threading.CancellationTokenSource 15000
  if (-not $ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, $deadline.Token).Wait(15000)) { $ws.Dispose(); throw "CDP connect timed out" }
  $body = @{ id = 1; method = $method; params = $params } | ConvertTo-Json -Depth 6 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($body)
  if (-not $ws.SendAsync([ArraySegment[byte]]$bytes, 'Text', $true, $deadline.Token).Wait(15000)) { $ws.Dispose(); throw "CDP send timed out" }
  if ($NoReply) { Start-Sleep -Milliseconds 300; $ws.Dispose(); return $null }
  $buffer = New-Object byte[] 1048576
  $text = ''
  do {
    $receive = $ws.ReceiveAsync([ArraySegment[byte]]$buffer, $deadline.Token)
    if (-not $receive.Wait(15000)) { $ws.Dispose(); throw "CDP reply timed out" }
    $r = $receive.Result
    $text += [Text.Encoding]::UTF8.GetString($buffer, 0, $r.Count)
  } while (-not $r.EndOfMessage)
  $ws.Dispose()
  ($text | ConvertFrom-Json).result
}

function Cdp-Eval([string]$expression, [string]$match = 'chrome://ardia/') {
  $result = Cdp-Command 'Runtime.evaluate' @{ expression = $expression; returnByValue = $true; awaitPromise = $true } $match
  if ($result) { $result.result.value } else { $null }
}

$App = 'C:\pilot\app'
$Data = 'C:\pilot\data'
$Proof = 'C:\pilot\proof'
New-Item -ItemType Directory -Force $Proof | Out-Null

function Start-Shell([switch]$Fresh, [string[]]$Extra = @()) {
  if ($Fresh) { Remove-Item -Recurse -Force $Data -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Force $Data | Out-Null
  $env:ARDIA_DATA_DIR = $Data
  $env:ARDIA_REMOTE_DEBUGGING_PORT = '9222'
  $arguments = @('--ardia-shell=webui', '--enable-logging', '--v=0') + $Extra
  Start-Process "$App\chrome.exe" -ArgumentList $arguments -PassThru
}

[Pilot]::AppDir = $App + '\'

function Engine-Processes { @(Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { [Pilot]::IsPilotProcess($_.Id) }) }

function Stop-Engine {
  Engine-Processes | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
}

function Start-Recording([string]$name, [int]$seconds) {
  Start-Process C:\tools\ffmpeg.exe -ArgumentList @('-hide_banner', '-loglevel', 'error', '-y', '-f', 'gdigrab', '-framerate', '15', '-draw_mouse', '1', '-i', 'desktop', '-t', "$seconds", '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', "$Proof\$name.mp4") -PassThru -WindowStyle Hidden
}

function Shell-Rect($h) { [Pilot]::Frame($h) }

function Log([string]$line) {
  $stamp = (Get-Date).ToString('HH:mm:ss.fff')
  "$stamp $line" | Tee-Object -FilePath "$Proof\steps.log" -Append
}

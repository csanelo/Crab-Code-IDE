import { spawn } from "node:child_process";

export interface DesktopWindow {
  processId: number;
  processName: string;
  title: string;
  handle: string;
}

export interface DesktopProcess {
  processId: number;
  name: string;
  title: string;
  memoryMb: number;
}

function windowsOnly(): void {
  if (process.platform !== "win32") {
    throw new Error("Computer control is currently available on Windows only.");
  }
}

function encodePowerShell(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

function runPowerShell(script: string): Promise<string> {
  windowsOnly();
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        encodePowerShell(script),
      ],
      { windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `PowerShell exited with code ${code}.`));
    });
  });
}

function jsonPowerShell<T>(script: string): Promise<T> {
  return runPowerShell(script).then((output) => {
    if (!output) return [] as T;
    return JSON.parse(output) as T;
  });
}

function user32Prelude(): string {
  return `
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class CrabCodeUser32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
'@
`;
}

function number(value: number, name: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }
  return Math.round(value);
}

function escapePsSingle(value: string): string {
  return value.replace(/'/g, "''");
}

function sendKeysSequence(keys: string): string {
  const normalized = keys.trim().toUpperCase();
  if (!normalized || !/^[A-Z0-9+_\-]+$/.test(normalized)) {
    throw new Error("keys must be a chord like CTRL+S, ALT+TAB, ENTER or F5.");
  }
  const parts = normalized.split("+");
  const modifiers = parts.slice(0, -1);
  const key = parts.at(-1) ?? "";
  const prefix = modifiers
    .map((part) => {
      if (part === "CTRL" || part === "CONTROL") return "^";
      if (part === "ALT") return "%";
      if (part === "SHIFT") return "+";
      throw new Error(`Unsupported key modifier: ${part}.`);
    })
    .join("");
  const named: Record<string, string> = {
    ENTER: "{ENTER}",
    TAB: "{TAB}",
    ESC: "{ESC}",
    ESCAPE: "{ESC}",
    SPACE: " ",
    BACKSPACE: "{BACKSPACE}",
    DELETE: "{DELETE}",
    UP: "{UP}",
    DOWN: "{DOWN}",
    LEFT: "{LEFT}",
    RIGHT: "{RIGHT}",
    HOME: "{HOME}",
    END: "{END}",
    PGUP: "{PGUP}",
    PGDN: "{PGDN}",
  };
  if (/^F(?:[1-9]|1[0-2])$/.test(key)) return `${prefix}{${key}}`;
  if (named[key]) return `${prefix}${named[key]}`;
  if (/^[A-Z0-9]$/.test(key)) return `${prefix}${key.toLowerCase()}`;
  throw new Error(`Unsupported key: ${key}.`);
}

export async function computerScreenshot(): Promise<string> {
  const base64 = await runPowerShell(`
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size)
$stream = New-Object System.IO.MemoryStream
$bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
[Convert]::ToBase64String($stream.ToArray())
$stream.Dispose()
`);
  if (!base64) throw new Error("Windows did not return a screenshot.");
  return `data:image/png;base64,${base64}`;
}

export async function computerListWindows(): Promise<DesktopWindow[]> {
  return jsonPowerShell<DesktopWindow[]>(`
@(
  Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } |
  Sort-Object ProcessName |
  ForEach-Object {
    [PSCustomObject]@{
      processId = $_.Id
      processName = $_.ProcessName
      title = $_.MainWindowTitle
      handle = $_.MainWindowHandle.ToInt64().ToString()
    }
  }
) | ConvertTo-Json -Compress
`);
}

export async function computerListProcesses(): Promise<DesktopProcess[]> {
  return jsonPowerShell<DesktopProcess[]>(`
@(
  Get-Process | Sort-Object ProcessName | ForEach-Object {
    [PSCustomObject]@{
      processId = $_.Id
      name = $_.ProcessName
      title = $_.MainWindowTitle
      memoryMb = [Math]::Round($_.WorkingSet64 / 1MB, 1)
    }
  }
) | ConvertTo-Json -Compress
`);
}

export async function computerFocusWindow(processId: number): Promise<void> {
  const pid = number(processId, "processId", 1, 4_294_967_295);
  await runPowerShell(`${user32Prelude()}
$process = Get-Process -Id ${pid} -ErrorAction Stop
$handle = $process.MainWindowHandle
if ($handle -eq 0) { throw "Process ${pid} has no main window." }
[CrabCodeUser32]::ShowWindow($handle, 9) | Out-Null
if (-not [CrabCodeUser32]::SetForegroundWindow($handle)) { throw "Windows did not focus process ${pid}." }
`);
}

export async function computerClick(
  x: number,
  y: number,
  button: "left" | "right" | "middle" = "left",
  clicks = 1,
): Promise<void> {
  const px = number(x, "x", -32_768, 32_767);
  const py = number(y, "y", -32_768, 32_767);
  const count = number(clicks, "clicks", 1, 2);
  const flags: Record<string, [number, number]> = {
    left: [0x0002, 0x0004],
    right: [0x0008, 0x0010],
    middle: [0x0020, 0x0040],
  };
  const [down, up] = flags[button];
  await runPowerShell(`${user32Prelude()}
if (-not [CrabCodeUser32]::SetCursorPos(${px}, ${py})) { throw "Could not move the mouse." }
1..${count} | ForEach-Object {
  [CrabCodeUser32]::mouse_event(${down}, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 35
  [CrabCodeUser32]::mouse_event(${up}, 0, 0, 0, [UIntPtr]::Zero)
  if ($_ -lt ${count}) { Start-Sleep -Milliseconds 90 }
}
`);
}

export async function computerScroll(delta: number): Promise<void> {
  const amount = number(delta, "delta", -12_000, 12_000);
  await runPowerShell(`${user32Prelude()}
[CrabCodeUser32]::mouse_event(0x0800, 0, 0, ${amount}, [UIntPtr]::Zero)
`);
}

export async function computerType(text: string): Promise<void> {
  if (!text) return;
  if (text.length > 20_000) throw new Error("text is limited to 20,000 characters per action.");
  await runPowerShell(`
Set-Clipboard -Value '${escapePsSingle(text)}'
$wshell = New-Object -ComObject WScript.Shell
$wshell.SendKeys('^v')
`);
}

export async function computerKeypress(keys: string): Promise<void> {
  const sequence = sendKeysSequence(keys);
  await runPowerShell(`
$wshell = New-Object -ComObject WScript.Shell
$wshell.SendKeys('${escapePsSingle(sequence)}')
`);
}

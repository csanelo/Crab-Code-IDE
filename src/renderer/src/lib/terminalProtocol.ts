export type TerminalShellPreference =
  | "auto"
  | "cmd"
  | "powershell"
  | "pwsh"
  | "bash"
  | "zsh"
  | "gitbash";

export interface TerminalCompletion {
  exitCode: number;
  cwd: string;
}

const COMPLETION_RE = /###CCEND:(-?\d+):([^\r\n\x07]*?)###/;

/**
 * Adds an internal completion probe after a command.
 * PowerShell and POSIX shells emit it as an OSC sequence: xterm receives the
 * payload for tracking but does not draw it in the terminal.
 */
export function terminalCompletionSuffix(
  shellPreference: string,
  isWindows: boolean,
): string {
  if (shellPreference === "powershell" || shellPreference === "pwsh") {
    // Avoid colon-based variable interpolation: PowerShell can parse it as a
    // scoped variable reference. The format operator works in Windows PowerShell
    // 5.1 and PowerShell 7 and safely handles drive-letter paths.
    return (
      " ; $cc = if ($?) { 0 } elseif ($null -ne $LASTEXITCODE -and " +
      "[int]$LASTEXITCODE -ne 0) { [int]$LASTEXITCODE } else { 1 }; " +
      "[Console]::Write(([char]27).ToString() + ']777;' + " +
      "('###CCEND:{0}:{1}###' -f $cc, (Get-Location).Path) + " +
      "([char]7).ToString())"
    );
  }
  if (shellPreference === "bash" || shellPreference === "gitbash") {
    return " ; code=$?; printf '\\033]777;###CCEND:%s:%s###\\007' \"$code\" \"$PWD\"";
  }
  if (shellPreference === "cmd" || (isWindows && shellPreference === "auto")) {
    // CALL delays expansion until after the user's command has finished.
    return " & call echo ###CCEND:%%errorlevel%%:%%cd%%###";
  }
  return " ; code=$?; printf '\\033]777;###CCEND:%s:%s###\\007' \"$code\" \"$PWD\"";
}

export function readTerminalCompletion(buffer: string): TerminalCompletion | null {
  const match = COMPLETION_RE.exec(buffer);
  if (!match) return null;
  return { exitCode: Number(match[1]), cwd: match[2] };
}

export function stripTerminalControlSequences(value: string): string {
  return value
    // OSC sequences, terminated by BEL or ST.
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    // CSI sequences.
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    // Character-set selection.
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b[()][0-9A-B]/g, "");
}

/** Removes a completed probe from rendered terminal output as a fallback for
 * shells (notably cmd.exe) that cannot emit the marker as an OSC sequence. */
export function stripTerminalCompletionForDisplay(value: string): string {
  if (!value.includes("###CCEND:")) return value;
  return stripTerminalControlSequences(value).replace(
    /[^\r\n]*###CCEND:-?\d+:[^\r\n]*?###[^\r\n]*(?:\r\n|\r|\n)?/g,
    "",
  );
}

/**
 * Removes only the private tracking suffix from the shell's echoed input.
 * The user still sees the exact command from the card, with no monitoring
 * implementation appended to it.
 */
export function stripWatchedCommandEcho(
  raw: string,
  command: string,
  suffix: string,
  force = false,
): { output: string; matched: boolean } {
  const plain = stripTerminalControlSequences(raw);
  const commandAt = plain.indexOf(command);
  const suffixAt = plain.indexOf(
    suffix,
    commandAt >= 0 ? commandAt + command.length : 0,
  );

  if (suffixAt >= 0) {
    return {
      output: plain.slice(0, suffixAt) + plain.slice(suffixAt + suffix.length),
      matched: true,
    };
  }

  // Fallback for shells that redraw a long command with cursor-control
  // sequences instead of echoing the suffix byte-for-byte.
  const markerAt = plain.indexOf("###CCEND:", commandAt >= 0 ? commandAt + command.length : 0);
  if (force && commandAt >= 0 && markerAt >= commandAt + command.length) {
    const commandEnd = commandAt + command.length;
    const lf = plain.indexOf("\n", markerAt);
    const cr = plain.indexOf("\r", markerAt);
    const endings = [lf, cr].filter((index) => index >= 0);
    const lineEnd = endings.length ? Math.min(...endings) : plain.length;
    return {
      output: plain.slice(0, commandEnd) + plain.slice(lineEnd),
      matched: true,
    };
  }

  return { output: raw, matched: false };
}

export function terminalPromptReturned(
  raw: string,
  shellPreference: string,
  isWindows: boolean,
): boolean {
  const plain = stripTerminalControlSequences(raw).replace(/\x08./g, "");
  const lines = plain.split(/\r\n|\n|\r/);
  const last = [...lines].reverse().find((line) => line.trim().length > 0)?.trim() ?? "";
  if (!last) return false;

  if (shellPreference === "powershell" || shellPreference === "pwsh") {
    return /^PS\s+.+>\s*$/i.test(last);
  }
  if (shellPreference === "cmd" || (isWindows && shellPreference === "auto")) {
    return /^(?:[A-Za-z]:\\|\\\\).*>\s*$/.test(last);
  }
  return /(?:^|\s)[$#%]\s*$/.test(last);
}

export function terminalOutputLooksFailed(output: string): boolean {
  return /(?:\berror\b|\bfailed\b|\bfailure\b|\bfatal\b|\bexception\b|\btraceback\b|\bpanic\b|parsererror|fullyqualifiederrorid|categoryinfo|command\s+not\s+found|not\s+recognized|недопустимая|ошибк|не\s+является\s+внутренней)/i.test(
    output,
  );
}

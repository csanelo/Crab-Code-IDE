export interface WhitespaceEditMatch {
  content: string;
  startLine: number;
  endLine: number;
}

function normalizeEditLine(line: string): string {
  return line.trim().replace(/[\t ]+/g, " ");
}

function lineIndent(line: string): string {
  return line.match(/^\s*/)?.[0] ?? "";
}

/**
 * Applies an edit when the requested block is semantically identical but its
 * indentation, tabs/spaces, or blank-line spacing drifted since it was read.
 * It deliberately refuses textual/fuzzy differences so a stale edit can never
 * overwrite a newer user or agent change.
 */
export function applyWhitespaceTolerantEdit(
  content: string,
  oldStr: string,
  newStr: string,
): WhitespaceEditMatch | null {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const sourceLines = content.replace(/\r\n/g, "\n").split("\n");
  const targetLines = oldStr.replace(/\r\n/g, "\n").split("\n");
  const targetNormalized = targetLines.map(normalizeEditLine);
  const meaningfulTarget = targetNormalized.filter(Boolean);

  if (
    meaningfulTarget.length === 0 ||
    meaningfulTarget.join("").length < 8 ||
    targetLines.length > sourceLines.length
  ) {
    return null;
  }

  const candidates = new Map<string, { start: number; end: number }>();
  const remember = (start: number, end: number): void => {
    candidates.set(`${start}:${end}`, { start, end });
  };

  // First try the same line structure while ignoring indentation and runs of
  // horizontal whitespace. This handles copied code formatted with tabs/spaces.
  for (let start = 0; start <= sourceLines.length - targetLines.length; start += 1) {
    let matches = true;
    for (let offset = 0; offset < targetNormalized.length; offset += 1) {
      if (normalizeEditLine(sourceLines[start + offset]) !== targetNormalized[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) remember(start, start + targetLines.length - 1);
  }

  // If blank lines alone changed, compare only meaningful lines and retain the
  // full source range between the first and last match.
  if (candidates.size === 0) {
    const sourceMeaningful = sourceLines
      .map((line, index) => ({ index, normalized: normalizeEditLine(line) }))
      .filter((line) => line.normalized.length > 0);

    for (
      let start = 0;
      start <= sourceMeaningful.length - meaningfulTarget.length;
      start += 1
    ) {
      let matches = true;
      for (let offset = 0; offset < meaningfulTarget.length; offset += 1) {
        if (sourceMeaningful[start + offset].normalized !== meaningfulTarget[offset]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        remember(
          sourceMeaningful[start].index,
          sourceMeaningful[start + meaningfulTarget.length - 1].index,
        );
      }
    }
  }

  if (candidates.size !== 1) return null;
  const [{ start, end }] = [...candidates.values()];

  const sourceFirstLine =
    sourceLines.slice(start, end + 1).find((line) => line.trim().length > 0) ?? "";
  const targetFirstLine = targetLines.find((line) => line.trim().length > 0) ?? "";
  const sourceIndent = lineIndent(sourceFirstLine);
  const targetIndent = lineIndent(targetFirstLine);
  const replacementLines = newStr.replace(/\r\n/g, "\n").split("\n");
  const adjustedReplacement = replacementLines.map((line) => {
    if (!line.trim()) return "";
    if (targetIndent && line.startsWith(targetIndent)) {
      return sourceIndent + line.slice(targetIndent.length);
    }
    if (!/^\s/.test(line)) return sourceIndent + line;
    return line;
  });

  sourceLines.splice(start, end - start + 1, ...adjustedReplacement);
  return {
    content: sourceLines.join(newline),
    startLine: start + 1,
    endLine: end + 1,
  };
}

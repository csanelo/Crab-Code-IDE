import { promises as fs } from "node:fs";
import { isAbsolute, resolve } from "node:path";

export interface AstSymbolNode {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "struct" | "enum" | "macro" | "variable";
  line: number;
  endLine: number;
  scope?: string;
  signature: string;
  docComment?: string;
}

export interface AstFileTree {
  path: string;
  totalLines: number;
  symbols: AstSymbolNode[];
}

export function parseAstSymbolsFromContent(filePath: string, content: string): AstFileTree {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const symbols: AstSymbolNode[] = [];

  // Patterns for C, C++, TS, JS, Rust, Go, Python
  const declPatterns: Array<{
    kind: AstSymbolNode["kind"];
    regex: RegExp;
  }> = [
    {
      kind: "function",
      regex: /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|fn|func)\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/,
    },
    {
      kind: "function",
      regex: /^(?:static\s+|inline\s+|extern\s+)?(?:[A-Za-z_][\w_]*_t|[A-Za-z_][\w_]*)\s+(?:\*\s*)?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{?$/,
    },
    {
      kind: "class",
      regex: /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/,
    },
    {
      kind: "interface",
      regex: /^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/,
    },
    {
      kind: "type",
      regex: /^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/,
    },
    {
      kind: "struct",
      regex: /^(?:typedef\s+)?struct\s+([A-Za-z_$][\w$]*)/,
    },
    {
      kind: "enum",
      regex: /^(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)/,
    },
    {
      kind: "macro",
      regex: /^\s*#\s*define\s+([A-Za-z_$][\w$]*)/,
    },
    {
      kind: "function",
      regex: /^\s*def\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\):/,
    },
  ];

  for (let idx = 0; idx < lines.length; idx++) {
    const lineText = lines[idx].trim();
    if (!lineText || lineText.startsWith("//") || lineText.startsWith("/*")) continue;

    for (const item of declPatterns) {
      const match = lineText.match(item.regex);
      if (match) {
        const symbolName = match[1];
        if (!symbolName || symbolName === "if" || symbolName === "for" || symbolName === "while" || symbolName === "switch") {
          continue;
        }

        // Find end line by brace matching
        let depth = 0;
        let endLine = idx + 1;
        let foundOpenBrace = false;

        for (let j = idx; j < Math.min(lines.length, idx + 300); j++) {
          const l = lines[j];
          if (l.includes("{")) {
            depth += (l.match(/\{/g) || []).length;
            foundOpenBrace = true;
          }
          if (l.includes("}")) {
            depth -= (l.match(/\}/g) || []).length;
          }
          if (foundOpenBrace && depth <= 0) {
            endLine = j + 1;
            break;
          }
        }

        // Extract JSDoc / C doc comment above declaration
        let docComment = "";
        if (idx > 0) {
          const prevLine = lines[idx - 1].trim();
          if (prevLine.endsWith("*/") || prevLine.startsWith("//")) {
            docComment = prevLine;
          }
        }

        symbols.push({
          name: symbolName,
          kind: item.kind,
          line: idx + 1,
          endLine: Math.max(idx + 1, endLine),
          signature: lineText.slice(0, 120),
          docComment: docComment || undefined,
        });

        break;
      }
    }
  }

  return {
    path: filePath,
    totalLines: lines.length,
    symbols,
  };
}

export async function parseAstFile(root: string, relPath: string): Promise<AstFileTree> {
  const absolute = isAbsolute(relPath) ? relPath : resolve(root, relPath);
  const content = await fs.readFile(absolute, "utf8");
  return parseAstSymbolsFromContent(relPath, content);
}

export async function getSymbolScopeAtLine(root: string, relPath: string, line: number): Promise<string> {
  let tree: AstFileTree;
  try {
    tree = await parseAstFile(root, relPath);
  } catch (err: any) {
    return `Error reading ${relPath}: ${err.message}`;
  }

  const enclosing = tree.symbols.find((s) => line >= s.line && line <= s.endLine);
  if (!enclosing) {
    return `Line ${line} in ${relPath} is at module/global scope (total lines: ${tree.totalLines}).`;
  }

  return `Line ${line} in ${relPath} is enclosed inside ${enclosing.kind} "${enclosing.name}" [L${enclosing.line}-L${enclosing.endLine}]:\n   ${enclosing.signature}`;
}

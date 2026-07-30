import { promises as fs } from "node:fs";
import { resolve, relative, join, isAbsolute, dirname } from "node:path";
import { homedir } from "node:os";
import { exec } from "node:child_process";
import { shell } from "electron";
import {
  addSkillFromUrl,
  addSkillFromRepo,
  listRepoSkills,
  createSkill,
  listSkills,
} from "./skills";
import { browserNavigate, browserCapture } from "./browser";
import { describeImage, activeModelHasVision } from "./vision";
import { addMcpServer, listMcpServers } from "./mcp";
import { connectGithub, getGithubAuth, commitAndPush } from "./github";
import {
  isRemotePath,
  parseRemote,
  ensureRemote,
  remoteSftp,
  remoteExec,
  upsertRemoteHost,
  connectRemoteHost,
  listRemoteHosts,
} from "./remote";
import { searchProjectIndex } from "./projectIndex";
import {
  computerClick,
  computerFocusWindow,
  computerKeypress,
  computerListProcesses,
  computerListWindows,
  computerScreenshot,
  computerScroll,
  computerType,
} from "./computer";

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolMeta {
  path: string;
  added: number;
  removed: number;
  diff: string;
  before: string;
  after: string;
  existed: boolean;
}

export interface ToolResult {
  text: string;
  meta?: ToolMeta;
  command?: string;
  mutated?: boolean;
  image?: { mimeType: string; dataUrl: string };
}

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "read_file",
    description:
      "Read a UTF-8 text file inside the project. Returns the content with 1-based line numbers. Use before editing.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Project-relative path to the file.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Create a NEW file with the given content. Use only when the path does not exist. NEVER use this tool to modify, replace, or rewrite an existing file; use edit_file for every existing file. Parent directories are created automatically.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Project-relative file path." },
        content: { type: "string", description: "Full file content to write." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description:
      "Modify an EXISTING file by replacing an exact substring. `old_str` must appear exactly once. Always use this tool for changes to existing files, including full-file rewrites (pass the current full content as old_str).",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Project-relative file path." },
        old_str: {
          type: "string",
          description: "Exact text to find (must be unique).",
        },
        new_str: { type: "string", description: "Replacement text." },
      },
      required: ["path", "old_str", "new_str"],
    },
  },
  {
    name: "list_dir",
    description:
      "List the immediate entries of a directory inside the project.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: 'Project-relative directory path. Use "." for the root.',
        },
      },
      required: ["path"],
    },
  },
  {
    name: "create_dir",
    description: "Create a directory (recursively) inside the project.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Project-relative directory path.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "delete_path",
    description: "Delete a file or directory (recursively) inside the project.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Project-relative path to remove.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "search",
    description:
      "Search file names and text with exact line numbers plus nearby Read context. Use this to locate a symbol/string before read_file or edit_file.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Case-insensitive substring to search for.",
        },
        path: { type: "string", description: "Optional project-relative file or folder to narrow the search." },
        context_lines: { type: "number", description: "Context lines before/after each hit (default 2, max 8)." },
        max_results: { type: "number", description: "Maximum matching locations (default 30, max 80)." },
      },
      required: ["query"],
    },
  },
  {
    name: "run_command",
    description:
      "Execute a shell command immediately. Use ONLY when the CURRENT user message explicitly asks the agent to run/execute it in the terminal. Otherwise use propose_command, including for builds, tests, installs, git and package managers.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute.",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "report_progress",
    description:
      "Publish one short, user-visible progress label before a meaningful investigation or implementation step. This is NOT private reasoning: write only a concise action summary such as 'Inspecting the authentication flow' or 'Comparing the changed files'. Do not include hidden chain-of-thought, secrets, or long explanations.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Short public label (3-10 words) for the next step." },
      },
      required: ["summary"],
    },
  },
  {
    name: "propose_command",
    description:
      'Show a shell command in the dedicated command card with Copy and Run buttons. ' +
      "This is the DEFAULT for every command: activation, dependency installation, builds, tests, git, package managers, scripts and servers. " +
      "It does NOT execute automatically. Use run_command only when the CURRENT user message explicitly asks the agent to execute the command in the terminal.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to propose.",
        },
        explanation: {
          type: "string",
          description: "Short note on what it does (optional).",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "web_search",
    description:
      "Search the public web and return top results. Use when Web is enabled and the task needs online research, current information, documentation, or a resource that is not available locally. Keep searches focused.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query." },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_url",
    description:
      "Fetch a web page and return readable text. Use when Web is enabled and reading a specific online page, repository file, documentation page, or search result helps complete the task.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Absolute https URL to fetch." },
      },
      required: ["url"],
    },
  },
  {
    name: "open_path",
    description:
      "HIGH ACCESS ONLY. Open a file, folder, application or URL with the OS default handler " +
      '(e.g. open a website in the browser, launch an app, reveal a folder). Use for "open Gmail", ' +
      '"open my calendar", "launch X".',
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "A URL, absolute file/folder path, or app name.",
        },
      },
      required: ["target"],
    },
  },
  {
    name: "move_path",
    description:
      "HIGH ACCESS ONLY. Move or rename a file/folder. Works across the whole machine (absolute paths).",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Source path." },
        to: { type: "string", description: "Destination path." },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "copy_path",
    description:
      "HIGH ACCESS ONLY. Copy a file/folder (recursively). Works across the whole machine (absolute paths). " +
      "Use to copy a project from one folder into another.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Source path." },
        to: { type: "string", description: "Destination path." },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "add_skill",
    description:
      "Install one or more skills from GitHub. Three ways to call it: " +
      "(1) url = a direct link to a SKILL.md file, a folder, or a repo root that has SKILL.md at the top. " +
      "(2) url = a repository (e.g. https://github.com/anthropics/skills) PLUS a `skills` array of names — " +
      "each is fetched from `skills/<name>/SKILL.md` inside that repo. This is exactly what " +
      "`npx skills add <repo> --skill <name> --skill <name>` means. " +
      "(3) url = a repository with NO `skills` array — lists the skills available in that repo so you " +
      "can show the user what they can install. Installed skills are saved under .crab/skills/<name>/ and " +
      "become /<name> slash commands.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            "GitHub URL to a SKILL.md file, a folder, or a repository.",
        },
        skills: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional: when url is a repo, the specific skill names to install (the --skill values), " +
            'e.g. ["frontend-design", "pdf"]. Omit to list what the repo offers.',
        },
      },
      required: ["url"],
    },
  },
  {
    name: "create_skill",
    description:
      "CREATE a brand-new skill and install it locally (no GitHub needed). A skill is a reusable " +
      "SKILL.md with frontmatter (name, description) and step-by-step instructions. Use this when the " +
      'user asks to "make/create a skill" for some task. After creating, it becomes a /<name> slash ' +
      "command immediately. Write clear, practical, progressive instructions in `body` (Markdown).",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: 'Short skill id (kebab-case), e.g. "release-notes".',
        },
        description: {
          type: "string",
          description: "One-line summary of what the skill does.",
        },
        body: {
          type: "string",
          description:
            "The SKILL.md instructions in Markdown (the part after the frontmatter). Include a title, " +
            "when to use it, and concrete numbered steps. Frontmatter is added automatically if omitted.",
        },
      },
      required: ["name", "description", "body"],
    },
  },
  {
    name: "list_skills",
    description:
      "List installed skills, OR (when `repo` is given) the skills available inside a GitHub repository " +
      "so you can tell the user what they can install with add_skill. Use the repo form to answer " +
      '"what skills are in <repo>?".',
    parameters: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description:
            "Optional GitHub repo URL to inspect (e.g. https://github.com/anthropics/skills).",
        },
      },
    },
  },
  {
    name: "read_memory",
    description:
      "Read the project's persistent local memory (.crab/MEMORY.md). This is private, on-disk knowledge " +
      "the agent keeps across sessions: user preferences, decisions, conventions, gotchas. It is already " +
      "injected into your context at the start, but use this to re-read the latest after writing.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "write_memory",
    description:
      "Append a durable note to the project's local memory (.crab/MEMORY.md). Use when you learn something " +
      "worth remembering for future sessions: the user's preferences, project conventions, architecture " +
      "decisions, recurring pitfalls. Keep notes short and factual. Stored locally, never uploaded.",
    parameters: {
      type: "object",
      properties: {
        note: {
          type: "string",
          description: "A concise fact to remember (one or two sentences).",
        },
      },
      required: ["note"],
    },
  },
  {
    name: "git_time_travel",
    description:
      "Investigate WHEN and WHY something changed using git history. Actions: " +
      '"log" (recent commits), "search" (find commits whose diff touches a string/regex via pickaxe), ' +
      '"show" (full diff of a commit), "blame" (who last changed a file region), ' +
      '"diff" (changes between two refs), "bisect_log" (commits between a good and bad ref to locate a regression). ' +
      "Use this to find the commit that introduced a bug, then read the code and fix it.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["log", "search", "show", "blame", "diff", "bisect_log"],
          description: "Which git investigation to run.",
        },
        query: {
          type: "string",
          description:
            'For "search": text/regex to find in diffs (pickaxe -S/-G).',
        },
        path: {
          type: "string",
          description: 'For "blame"/"log": limit to this file.',
        },
        ref: {
          type: "string",
          description: 'For "show": commit hash. For "diff": base ref.',
        },
        ref2: {
          type: "string",
          description: 'For "diff": target ref (default HEAD).',
        },
        good: {
          type: "string",
          description: 'For "bisect_log": last known-good ref.',
        },
        bad: {
          type: "string",
          description: 'For "bisect_log": known-bad ref (default HEAD).',
        },
      },
      required: ["action"],
    },
  },
  {
    name: "browser_open",
    description:
      'Open the in-editor browser (the agent\'s "eyes") and navigate to a URL. Use this to look at a ' +
      "running dev server, documentation, a design, or any web page you need to SEE. After opening, " +
      "use browser_read to get the page text or browser_screenshot to see it visually.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            "URL to open (https). A bare domain or query also works.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_read",
    description:
      "Read the readable text of the page currently shown in the in-editor browser (or the user's " +
      "selection if any). Open a page first with browser_open. Returns the visible text content.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "browser_screenshot",
    description:
      "Capture a screenshot of the page currently shown in the in-editor browser and SEE it: the " +
      "image is returned to you so you can visually judge layout, colors, typography and spacing. " +
      "Open a page first with browser_open.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "computer_screenshot",
    description:
      "HIGH ACCESS ONLY. Capture the whole Windows desktop and SEE it. Use this before interacting with desktop applications, and after important UI actions to verify the result.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "computer_list_windows",
    description:
      "HIGH ACCESS ONLY. List visible desktop application windows with process IDs, titles and process names. Use this before focusing an application.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "computer_focus_window",
    description:
      "HIGH ACCESS ONLY. Bring a desktop window to the foreground using its processId from computer_list_windows.",
    parameters: {
      type: "object",
      properties: { processId: { type: "number", description: "Target Windows process ID." } },
      required: ["processId"],
    },
  },
  {
    name: "computer_click",
    description:
      "HIGH ACCESS ONLY. Click the desktop at screen coordinates. Take a fresh screenshot immediately before clicking and use coordinates from that screenshot.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number", description: "Screen X coordinate." },
        y: { type: "number", description: "Screen Y coordinate." },
        button: { type: "string", enum: ["left", "right", "middle"], description: "Mouse button; defaults to left." },
        clicks: { type: "number", enum: [1, 2], description: "Click count; defaults to one." },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "computer_type",
    description:
      "HIGH ACCESS ONLY. Paste text into the focused desktop application. Focus the intended window first. Text is sent through the Windows clipboard for reliable Unicode input.",
    parameters: {
      type: "object",
      properties: { text: { type: "string", description: "Text to paste into the focused control." } },
      required: ["text"],
    },
  },
  {
    name: "computer_keypress",
    description:
      "HIGH ACCESS ONLY. Send one keyboard chord to the focused desktop application, for example CTRL+S, CTRL+L, ALT+TAB, ENTER, ESC or F5.",
    parameters: {
      type: "object",
      properties: { keys: { type: "string", description: "One keyboard chord." } },
      required: ["keys"],
    },
  },
  {
    name: "computer_scroll",
    description:
      "HIGH ACCESS ONLY. Scroll the focused desktop window. Positive values scroll up; negative values scroll down.",
    parameters: {
      type: "object",
      properties: { delta: { type: "number", description: "Windows mouse-wheel delta." } },
      required: ["delta"],
    },
  },
  {
    name: "computer_list_processes",
    description:
      "HIGH ACCESS ONLY. List running Windows processes with their IDs, titles and memory use. Use this to locate or verify a desktop application.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_mcp_servers",
    description:
      "List the configured MCP servers and their status (enabled/disabled, transport, command/url). " +
      "Use when the user runs /mcp or asks which MCP servers are set up.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "add_mcp_server",
    description:
      "Connect (register) an MCP server for the user from chat. Use when the user asks to add/connect " +
      'an MCP server. Two transports: "stdio" (a local command, e.g. npx a package) or "http"/"sse" ' +
      "(a remote endpoint URL). Provide a short name. For stdio set command (+ optional args/env); for " +
      "http/sse set url (+ optional headers). The server is saved and enabled. " +
      'You may instead pass the raw line the user pasted as "spec" (a URL or a full command like ' +
      '"npx -y @scope/pkg") and the transport, command, args and name are derived from it. ' +
      "Never ask the user to add the server manually in Settings — just call this tool.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            'Short identifier for the server (e.g. "github", "fetch").',
        },
        transport: {
          type: "string",
          enum: ["stdio", "http", "sse"],
          description: "stdio = local command; http/sse = remote endpoint.",
        },
        command: {
          type: "string",
          description: 'stdio: executable to launch (e.g. "npx").',
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "stdio: command arguments.",
        },
        env: {
          type: "object",
          description: "stdio: environment variables (KEY: value).",
        },
        url: { type: "string", description: "http/sse: the endpoint URL." },
        headers: {
          type: "object",
          description: "http/sse: request headers (e.g. Authorization).",
        },
        spec: {
          type: "string",
          description:
            "Raw pasted line to parse: an endpoint URL or a launch command. " +
            "Use this when the user just pasted a link or command.",
        },
      },
      required: [],
    },
  },
  {
    name: "list_ssh_hosts",
    description:
      "List the saved SSH hosts (label, user@host:port, remote root). Use before connecting to check " +
      "whether the host already exists.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "ssh_connect",
    description:
      "Save an SSH host and connect to it immediately, so remote files and terminals work. Use when " +
      'the user asks to connect over SSH and gives the details (e.g. "ssh root@1.2.3.4 password X"). ' +
      'Pass the pasted line as "target" (supports user@host, user@host:port and ssh://user@host:port/path) ' +
      "or fill host/username/port separately. Authentication needs either password or keyPath. " +
      "Never tell the user to add the host manually in Settings — just call this tool.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description:
            'Connection string, e.g. "root@203.0.113.7:2222" or "ssh://user@host/srv/app".',
        },
        host: { type: "string", description: "Hostname or IP address." },
        username: { type: "string", description: "SSH user name." },
        port: { type: "number", description: "SSH port (default 22)." },
        password: {
          type: "string",
          description: "Password auth: the user's SSH password.",
        },
        keyPath: {
          type: "string",
          description: "Key auth: absolute path to the private key file.",
        },
        passphrase: {
          type: "string",
          description: "Key auth: passphrase for the private key, if any.",
        },
        remoteRoot: {
          type: "string",
          description: "Directory to open on the host (default the login directory).",
        },
        label: { type: "string", description: "Optional display name." },
      },
      required: [],
    },
  },
  {
    name: "github_connect",
    description:
      "Connect the user's GitHub account using a Personal Access Token (PAT) they paste in chat. " +
      'Use when the user asks to "connect GitHub" and provides a token (ghp_... or github_pat_...). ' +
      "Validates and securely stores the token. After this, commits/pushes work. Call it as soon as a " +
      "token appears in the chat — never tell the user to paste it into Settings themselves.",
    parameters: {
      type: "object",
      properties: {
        token: {
          type: "string",
          description: "The GitHub Personal Access Token to connect with.",
        },
      },
      required: ["token"],
    },
  },
  {
    name: "github_status",
    description:
      "Check whether GitHub is connected (and as which user). Use before committing to decide if you " +
      "need to ask the user for a token first.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "github_commit",
    description:
      'Commit and push changes in the current GitHub project. Use when the user says "commit all", ' +
      '"commit this file", etc. Requires GitHub to be connected — if not, ask the user for a token ' +
      "and call github_connect first. Stages all changes, or only the given paths, then pushes.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "Commit message." },
        paths: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional: project-relative file paths to commit. Omit to commit everything.",
        },
      },
      required: ["message"],
    },
  },
];

/**
 * Turns a raw line the user pasted into MCP server fields. Accepts an endpoint
 * URL or a launch command, so the agent can connect a server without the user
 * spelling out transport/command/args by hand.
 */
function deriveMcpSpec(spec: string): {
  transport: "stdio" | "http" | "sse" | "";
  command: string;
  args: string[];
  url: string;
  name: string;
} {
  const empty = {
    transport: "" as const,
    command: "",
    args: [] as string[],
    url: "",
    name: "",
  };
  const line = spec.trim();
  if (!line) return empty;

  if (/^https?:\/\//i.test(line)) {
    let name = "";
    try {
      const parsed = new URL(line);
      // Prefer a meaningful path segment (".../github/mcp") over the bare host.
      const segment = parsed.pathname
        .split("/")
        .filter((part) => part && !/^(mcp|sse|v\d+|api)$/i.test(part))
        .pop();
      name = segment ?? parsed.hostname.split(".")[0] ?? "";
    } catch {
      name = "";
    }
    return {
      transport: /\bsse\b/i.test(line) ? "sse" : "http",
      command: "",
      args: [],
      url: line,
      name,
    };
  }

  // Split on whitespace while keeping quoted arguments in one piece.
  const parts = (line.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((part) =>
    part.replace(/^["']|["']$/g, ""),
  );
  if (parts.length === 0) return empty;
  const command = parts[0];
  const args = parts.slice(1);
  // Name after the package: "npx -y @modelcontextprotocol/server-git" -> "server-git".
  const pkg = args.find((arg) => !arg.startsWith("-")) ?? command;
  const name = pkg.split("/").pop()?.replace(/^@/, "") ?? command;
  return { transport: "stdio", command, args, url: "", name };
}

const IGNORED = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "build",
  ".next",
  ".cache",
  "target",
  "vendor",
  ".venv",
  "__pycache__",
]);

function safe(root: string, p: string, fullAccess = false): string {
  const abs = isAbsolute(p) ? p : resolve(root, p);
  if (fullAccess) return abs;
  const rel = relative(root, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Path escapes the project root: ${p}`);
  }
  return abs;
}

function withLineNumbers(content: string): string {
  const lines = content.split("\n");
  const width = String(lines.length).length;
  return lines
    .map((l, i) => `${String(i + 1).padStart(width, " ")}  ${l}`)
    .join("\n");
}

// Agents receive numbered file reads for orientation. If they copy those lines
// into old_str, accept the intended source text instead of failing the edit.
function friendlyFileToolError(name: string, input: Record<string, unknown>, err: unknown): string {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code ?? "") : "";
  const path = String(input.path ?? input.from ?? "the requested path");
  if (code === "ENOENT") {
    if (name === "read_file") return `Retry: ${path} does not exist. Do NOT invent a path or report a raw filesystem error. First use list_dir or search to find the real filename, then read that file.`;
    if (name === "edit_file") return `Retry: ${path} does not exist. Do NOT use edit_file on a missing file. Use list_dir/search to verify its name; use write_file only if the user actually requested a new file.`;
    if (name === "write_file" || name === "create_dir") return `Retry: could not create ${path}. Re-check the parent path with list_dir, then retry with a valid project-relative path.`;
    return `Retry: ${path} was not found. Verify the path with list_dir or search before retrying.`;
  }
  if (code === "EACCES" || code === "EPERM") return `Retry: permission was denied for ${path}. Stay inside the open project and choose a writable path.`;
  return `Retry: ${name} could not complete for ${path}. Re-check the path and current file state, then retry.`;
}

function stripCopiedLineNumbers(text: string): string {
  const lines = text.split("\n");
  const numbered = lines.filter((line) => /^\s*\d+\s{2}/.test(line));
  if (numbered.length === 0) return text;
  return lines.map((line) => line.replace(/^\s*\d+\s{2}/, "")).join("\n");
}

export async function runTool(
  root: string,
  name: string,
  input: Record<string, unknown>,
  access: "normal" | "high" = "normal",
  editMode: "auto" | "ask" | "readonly" = "auto",
): Promise<ToolResult> {
  const MUTATING = new Set([
    "write_file",
    "edit_file",
    "create_dir",
    "delete_path",
    "move_path",
    "copy_path",
  ]);
  if (editMode === "readonly" && MUTATING.has(name)) {
    return {
      text: `Error: edit mode is Read Only — "${name}" is not allowed.`,
    };
  }

  if (isRemotePath(root)) {
    return runRemoteTool(root, name, input);
  }

  const fullAccess = access === "high";
  if (!root && !fullAccess) {
    return {
      text: "Error: no project folder is open. Ask the user to open a folder first.",
    };
  }
  const base = root || homedir();

  try {
    switch (name) {
      case "read_file": {
        const abs = safe(base, String(input.path), fullAccess);
        const content = await fs.readFile(abs, "utf8");
        if (content.length > 60_000) {
          return {
            text:
              `File is large (${content.length} chars). First 60000 chars:\n` +
              withLineNumbers(content.slice(0, 60_000)),
          };
        }
        return { text: withLineNumbers(content) };
      }

      case "write_file": {
        const abs = safe(base, String(input.path), fullAccess);
        const rel = String(input.path);
        const next = String(input.content ?? "");
        let prev = "";
        let existed = true;
        try {
          prev = await fs.readFile(abs, "utf8");
        } catch {
          prev = "";
          existed = false;
        }
        await fs.mkdir(dirname(abs), { recursive: true });
        await fs.writeFile(abs, next, "utf8");
        const meta = buildDiff(rel, prev, next, existed);
        return {
          text: `Wrote ${rel} (+${meta.added} -${meta.removed}).`,
          meta,
          mutated: true,
        };
      }

      case "edit_file": {
        const abs = safe(base, String(input.path), fullAccess);
        const rel = String(input.path);
        const oldStr = stripCopiedLineNumbers(String(input.old_str ?? ""));
        const newStr = String(input.new_str ?? "");
        const content = await fs.readFile(abs, "utf8");
        const count = content.split(oldStr).length - 1;
        if (oldStr === "") return { text: "Retry: old_str was empty. Read the file and retry with the exact target text." };
        if (count === 0) return { text: `Retry: target text was not found in ${rel}. Read the latest file contents, then retry the edit.` };
        if (count > 1) {
          return {
            text: `Retry: target text appears ${count} times in ${rel}. Read the file and include more surrounding lines so the edit is unique.`,
          };
        }
        const next = content.replace(oldStr, newStr);
        await fs.writeFile(abs, next, "utf8");
        const meta = buildDiff(rel, content, next, true);
        return {
          text: `Edited ${rel} (+${meta.added} -${meta.removed}).`,
          meta,
          mutated: true,
        };
      }

      case "list_dir": {
        const abs = safe(base, String(input.path ?? "."), fullAccess);
        const entries = await fs.readdir(abs, { withFileTypes: true });
        const list = entries
          .filter((e) => !IGNORED.has(e.name))
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .sort();
        return { text: list.length ? list.join("\n") : "(empty)" };
      }

      case "create_dir": {
        const abs = safe(base, String(input.path), fullAccess);
        await fs.mkdir(abs, { recursive: true });
        return {
          text: `Created directory ${String(input.path)}.`,
          mutated: true,
        };
      }

      case "delete_path": {
        const abs = safe(base, String(input.path), fullAccess);
        await fs.rm(abs, { recursive: true, force: true });
        return { text: `Deleted ${String(input.path)}.`, mutated: true };
      }

      case "search": {
        const q = String(input.query ?? "").trim();
        if (!q) return { text: "Error: empty query." };
        const requestedPath = String(input.path ?? ".").trim() || ".";
        const scope = safe(base, requestedPath, fullAccess);
        const contextLines = Math.max(0, Math.min(8, Number(input.context_lines ?? 2) | 0));
        const maxResults = Math.max(1, Math.min(80, Number(input.max_results ?? 30) | 0));
        const hits = await searchProjectContext(base, scope, q, contextLines, maxResults);
        if (hits.length) return { text: hits.join("\n\n") };
        const indexedHits = await searchProjectIndex(base, q.toLowerCase());
        return { text: indexedHits.length ? indexedHits.join("\n") : "No matches. Try a shorter term or list_dir to verify the path." };
      }

      case "run_command": {
        const command = String(input.command ?? "");
        if (!command.trim()) return { text: "Error: empty command." };
        return { text: await runCommand(base, command) };
      }

      case "report_progress": {
        const summary = String(input.summary ?? "").trim().slice(0, 160);
        return { text: summary || "Working on the next step." };
      }

      case "propose_command": {
        const command = String(input.command ?? "").trim();
        if (!command) return { text: "Error: empty command." };
        const note = String(input.explanation ?? "").trim();
        return {
          text:
            `Proposed command for the user to run: \`${command}\`.` +
            (note ? ` (${note})` : "") +
            " The user can run it from the chat with one click.",
          command,
        };
      }

      case "web_search": {
        const query = String(input.query ?? "").trim();
        if (!query) return { text: "Error: empty query." };
        return { text: await webSearch(query) };
      }

      case "fetch_url": {
        const url = String(input.url ?? "").trim();
        if (!/^https?:\/\//i.test(url))
          return { text: "Error: provide an absolute http(s) URL." };
        return { text: await fetchUrl(url) };
      }

      case "add_skill": {
        const url = String(input.url ?? "").trim();
        const names = Array.isArray(input.skills)
          ? input.skills.map((s) => String(s).trim()).filter(Boolean)
          : [];

        if (names.length > 0) {
          const done: string[] = [];
          const failed: string[] = [];
          for (const n of names) {
            const r = await addSkillFromRepo(root, url, n);
            if (r.ok) done.push(`/${r.name}`);
            else failed.push(`${n} (${r.error})`);
          }
          const parts: string[] = [];
          if (done.length)
            parts.push(
              `Installed: ${done.join(", ")}. They are available as slash commands.`,
            );
          if (failed.length) parts.push(`Failed: ${failed.join("; ")}.`);
          return {
            text: parts.join(" ") || "Nothing installed.",
            mutated: done.length > 0,
          };
        }

        const looksLikeRepoRoot =
          /github\.com\/[^/]+\/[^/?#]+\/?($|\?|#)/i.test(url) &&
          !/\/(blob|tree)\//i.test(url) &&
          !/SKILL\.md$/i.test(url);
        const direct = await addSkillFromUrl(root, url);
        if (direct.ok) {
          return {
            text:
              `Installed skill "/${direct.name}"${direct.description ? ` — ${direct.description}` : ""}. ` +
              `Read .crab/skills/${direct.name}/SKILL.md to use it.`,
            mutated: true,
          };
        }
        if (looksLikeRepoRoot) {
          const listed = await listRepoSkills(url);
          if (listed.ok && listed.skills?.length) {
            return {
              text:
                `That repo doesn't have a SKILL.md at its root, but it offers these skills:\n` +
                listed.skills.map((s) => `- ${s}`).join("\n") +
                `\n\nInstall one with add_skill { url, skills: ["<name>"] }.`,
            };
          }
        }
        return { text: `Error: ${direct.error}` };
      }

      case "create_skill": {
        const name = String(input.name ?? "").trim();
        const description = String(input.description ?? "").trim();
        const body = String(input.body ?? "");
        if (!name) return { text: "Error: provide a skill name." };
        if (!body.trim())
          return { text: "Error: provide the SKILL.md body (instructions)." };
        const r = await createSkill(root, name, description, body);
        if (!r.ok) return { text: `Error: ${r.error}` };
        return {
          text:
            `Created skill "/${r.name}"${r.description ? ` — ${r.description}` : ""}. ` +
            `Saved to .crab/skills/${r.name}/SKILL.md and available as the /${r.name} command.`,
          mutated: true,
        };
      }

      case "list_skills": {
        const repo = String(input.repo ?? "").trim();
        if (repo) {
          const listed = await listRepoSkills(repo);
          if (!listed.ok) return { text: `Error: ${listed.error}` };
          return {
            text:
              `Skills available in ${repo}:\n` +
              (listed.skills ?? []).map((s) => `- ${s}`).join("\n") +
              `\n\nInstall with add_skill { url: "${repo}", skills: ["<name>"] }.`,
          };
        }
        const skills = await listSkills(root);
        if (skills.length === 0) return { text: "No skills installed yet." };
        return {
          text:
            "Installed skills:\n" +
            skills
              .map(
                (s) => `- /${s.name}: ${s.description || "(no description)"}`,
              )
              .join("\n"),
        };
      }

      case "read_memory": {
        const text = await readProjectMemory(base);
        return { text: text || "(memory is empty)" };
      }

      case "write_memory": {
        const note = String(input.note ?? "").trim();
        if (!note) return { text: "Error: empty note." };
        await appendProjectMemory(base, note);
        return { text: `Saved to memory: ${note}`, mutated: true };
      }

      case "git_time_travel": {
        return runGitTimeTravel(base, input);
      }

      case "browser_open": {
        const url = String(input.url ?? "").trim();
        if (!url) return { text: "Error: empty url." };
        browserNavigate(url);
        return {
          text: `Opened the in-editor browser at ${url}. Use browser_read for text or browser_screenshot to see it.`,
        };
      }

      case "browser_read": {
        const res = await browserCapture("text");
        if (!res.ok)
          return { text: `Error: ${res.error ?? "could not read page"}` };
        return {
          text: `Page: ${res.title ?? ""} (${res.url ?? ""})\n\n${(res.data ?? "").slice(0, 12000)}`,
        };
      }

      case "browser_screenshot": {
        const res = await browserCapture("screenshot");
        if (!res.ok)
          return { text: `Error: ${res.error ?? "could not capture page"}` };
        const where = `${res.url ?? "the page"}${res.title ? ` — ${res.title}` : ""}`;
        if (await activeModelHasVision()) {
          return {
            text: `Screenshot of ${where}. Look at the image to judge the layout and visual style.`,
            image: res.data
              ? { mimeType: "image/png", dataUrl: res.data }
              : undefined,
          };
        }
        const description = res.data ? await describeImage(res.data) : null;
        if (description) {
          return {
            text: `Screenshot of ${where}. Visual description (from the vision model):\n\n${description}`,
          };
        }
        return {
          text: `Screenshot of ${where} was captured, but the active model accepts text only and no vision model is connected. Use browser_read for page structure instead.`,
        };
      }

      case "computer_screenshot": {
        if (!fullAccess)
          return { text: "Error: computer_screenshot requires High access level." };
        const dataUrl = await computerScreenshot();
        if (await activeModelHasVision()) {
          return {
            text: "Desktop screenshot captured. Inspect it before choosing a computer_click action.",
            image: { mimeType: "image/png", dataUrl },
          };
        }
        const description = await describeImage(dataUrl);
        if (description) {
          return {
            text:
              "Desktop screenshot captured. Visual description from the connected vision model:\n\n" +
              description,
          };
        }
        return {
          text:
            "Desktop screenshot captured, but the active model accepts text only and no vision model is connected. " +
            "Use computer_list_windows, focus a known window, and prefer keyboard shortcuts until a vision-capable model is available.",
        };
      }

      case "computer_list_windows": {
        if (!fullAccess)
          return { text: "Error: computer_list_windows requires High access level." };
        const windows = await computerListWindows();
        if (!windows.length) return { text: "No visible desktop windows found." };
        return {
          text: windows
            .map((window) => `- ${window.processName} [${window.processId}] — ${window.title}`)
            .join("\n"),
        };
      }

      case "computer_focus_window": {
        if (!fullAccess)
          return { text: "Error: computer_focus_window requires High access level." };
        const processId = Number(input.processId);
        await computerFocusWindow(processId);
        return { text: `Focused desktop process ${processId}.` };
      }

      case "computer_click": {
        if (!fullAccess)
          return { text: "Error: computer_click requires High access level." };
        const x = Number(input.x);
        const y = Number(input.y);
        const button = String(input.button ?? "left") as "left" | "right" | "middle";
        if (!(["left", "right", "middle"] as string[]).includes(button)) {
          return { text: "Error: button must be left, right or middle." };
        }
        await computerClick(x, y, button, Number(input.clicks ?? 1));
        return { text: `Clicked ${button} at ${x}, ${y}.` };
      }

      case "computer_type": {
        if (!fullAccess)
          return { text: "Error: computer_type requires High access level." };
        const text = String(input.text ?? "");
        if (!text) return { text: "Error: text is empty." };
        await computerType(text);
        return { text: `Typed ${text.length} character(s) into the focused window.` };
      }

      case "computer_keypress": {
        if (!fullAccess)
          return { text: "Error: computer_keypress requires High access level." };
        const keys = String(input.keys ?? "");
        await computerKeypress(keys);
        return { text: `Sent ${keys} to the focused window.` };
      }

      case "computer_scroll": {
        if (!fullAccess)
          return { text: "Error: computer_scroll requires High access level." };
        const delta = Number(input.delta);
        await computerScroll(delta);
        return { text: `Scrolled the focused window by ${delta}.` };
      }

      case "computer_list_processes": {
        if (!fullAccess)
          return { text: "Error: computer_list_processes requires High access level." };
        const processes = await computerListProcesses();
        return {
          text: processes
            .map((process) => `- ${process.name} [${process.processId}]${process.title ? ` — ${process.title}` : ""} (${process.memoryMb} MB)`)
            .join("\n"),
        };
      }

      case "list_mcp_servers": {
        const servers = listMcpServers();
        if (servers.length === 0) {
          return { text: "No MCP servers configured yet." };
        }
        const lines = servers.map((s) => {
          const status = s.enabled ? "enabled" : "disabled";
          const detail =
            s.transport === "stdio"
              ? `stdio: ${s.command ?? ""} ${(s.args ?? []).join(" ")}`.trim()
              : `${s.transport}: ${s.url ?? ""}`;
          return `- ${s.name} [${status}] — ${detail}`;
        });
        return {
          text: `MCP servers (${servers.length}):\n${lines.join("\n")}`,
        };
      }

      case "add_mcp_server": {
        const derived = deriveMcpSpec(String(input.spec ?? ""));
        const explicitUrl = String(input.url ?? "").trim();
        const transport = (String(input.transport ?? "").trim() ||
          derived.transport ||
          (explicitUrl ? "http" : "stdio")) as "stdio" | "http" | "sse";
        const name =
          String(input.name ?? "").trim() || derived.name || "mcp-server";
        if (transport === "stdio") {
          const command = String(input.command ?? "").trim() || derived.command;
          if (!command)
            return { text: 'Error: stdio transport requires a "command".' };
          const args =
            Array.isArray(input.args) && input.args.length > 0
              ? input.args.map(String)
              : derived.args;
          const env =
            input.env && typeof input.env === "object"
              ? (input.env as Record<string, string>)
              : {};
          const saved = addMcpServer({
            name,
            transport,
            command,
            args,
            env,
            enabled: true,
          });
          return {
            text: `Connected MCP server "${saved.name}" (stdio: ${command} ${args.join(" ")}). It is enabled and saved.`,
            mutated: true,
          };
        } else {
          const url = explicitUrl || derived.url;
          if (!url)
            return { text: `Error: ${transport} transport requires a "url".` };
          const headers =
            input.headers && typeof input.headers === "object"
              ? (input.headers as Record<string, string>)
              : {};
          const saved = addMcpServer({
            name,
            transport,
            url,
            headers,
            enabled: true,
          });
          return {
            text: `Connected MCP server "${saved.name}" (${transport}: ${url}). It is enabled and saved.`,
            mutated: true,
          };
        }
      }

      case "list_ssh_hosts": {
        const hosts = listRemoteHosts();
        if (hosts.length === 0)
          return { text: "No SSH hosts are saved yet." };
        const lines = hosts.map(
          (h) =>
            `- ${h.label} — ${h.username}@${h.host}:${h.port} (root ${h.remoteRoot}, ${h.authType})`,
        );
        return { text: `SSH hosts (${hosts.length}):\n${lines.join("\n")}` };
      }

      case "ssh_connect": {
        let host = String(input.host ?? "").trim();
        let username = String(input.username ?? "").trim();
        let port = Number(input.port ?? 0) || 0;
        let remoteRoot = String(input.remoteRoot ?? "").trim();

        // Accept a pasted connection string: ssh://user@host:port/path,
        // user@host:port, or a bare host.
        const target = String(input.target ?? "")
          .trim()
          .replace(/^ssh\s+/i, "")
          .replace(/^ssh:\/\//i, "");
        if (target) {
          const slash = target.indexOf("/");
          const authority = slash < 0 ? target : target.slice(0, slash);
          if (slash >= 0 && !remoteRoot) remoteRoot = target.slice(slash);
          const at = authority.lastIndexOf("@");
          const hostPart = at < 0 ? authority : authority.slice(at + 1);
          if (at > 0 && !username) username = authority.slice(0, at);
          const colon = hostPart.lastIndexOf(":");
          if (colon > 0 && /^\d+$/.test(hostPart.slice(colon + 1))) {
            if (!port) port = Number(hostPart.slice(colon + 1));
            if (!host) host = hostPart.slice(0, colon);
          } else if (!host) {
            host = hostPart;
          }
        }

        if (!host)
          return {
            text: "Error: no host given. Ask the user for host and user (e.g. root@203.0.113.7).",
          };

        const password = String(input.password ?? "");
        const keyPath = String(input.keyPath ?? "").trim();
        if (!password && !keyPath)
          return {
            text:
              `Error: no credentials for ${host}. Ask the user for the SSH password ` +
              "or the path to their private key, then call ssh_connect again.",
          };

        const { id } = upsertRemoteHost({
          label: String(input.label ?? "").trim() || host,
          host,
          port: port || 22,
          username: username || "root",
          authType: keyPath ? "key" : "password",
          keyPath: keyPath || undefined,
          password: password || undefined,
          passphrase: String(input.passphrase ?? "") || undefined,
          remoteRoot: remoteRoot || ".",
        });

        const res = await connectRemoteHost(id);
        if (res.error)
          return { text: `SSH connection to ${host} failed: ${res.error}` };
        return {
          text:
            `Connected over SSH to ${username || "root"}@${host}:${port || 22}. ` +
            `Remote root: ${res.rootPath ?? "(unknown)"}. Remote files and terminals are ready.`,
          mutated: true,
        };
      }

      case "github_connect": {
        const tk = String(input.token ?? "").trim();
        if (!tk)
          return {
            text: "Error: no token provided. Ask the user to paste their GitHub token.",
          };
        const r = await connectGithub(tk);
        if (!r.ok)
          return { text: `Error connecting GitHub: ${r.error ?? "failed"}` };
        return {
          text: `Connected GitHub as ${r.login ?? "user"}. You can now commit and push.`,
          mutated: true,
        };
      }

      case "github_status": {
        const auth = getGithubAuth();
        return {
          text: auth.connected
            ? `GitHub is connected as ${auth.login ?? "user"}.`
            : "GitHub is NOT connected. Ask the user to paste a Personal Access Token, then call github_connect.",
        };
      }

      case "github_commit": {
        const auth = getGithubAuth();
        if (!auth.connected) {
          return {
            text:
              "GitHub is not connected. Ask the user to paste a GitHub Personal Access Token, " +
              "then call github_connect before committing.",
          };
        }
        if (!root) return { text: "Error: no project is open." };
        const message =
          String(input.message ?? "").trim() || "Update from CrabCode";
        const paths = Array.isArray(input.paths)
          ? input.paths.map(String)
          : undefined;
        const res = await commitAndPush({ path: root, message, paths });
        if (!res.ok)
          return { text: `Commit failed: ${res.error ?? "unknown error"}` };
        return {
          text:
            paths && paths.length > 0
              ? `Committed and pushed ${paths.length} file(s) with message "${message}".`
              : `Committed and pushed all changes with message "${message}".`,
          mutated: true,
        };
      }

      case "open_path": {
        if (!fullAccess)
          return { text: "Error: open_path requires High access level." };
        const target = String(input.target ?? "").trim();
        if (!target) return { text: "Error: empty target." };
        try {
          if (/^https?:\/\//i.test(target)) {
            await shell.openExternal(target);
          } else if (isAbsolute(target)) {
            const err = await shell.openPath(target);
            if (err) return { text: `Could not open: ${err}` };
          } else {
            await openApp(target);
          }
          return { text: `Opened ${target}.` };
        } catch (err) {
          return {
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }

      case "move_path": {
        if (!fullAccess)
          return { text: "Error: move_path requires High access level." };
        const from = safe(base, String(input.from), true);
        const to = safe(base, String(input.to), true);
        await fs.mkdir(dirname(to), { recursive: true });
        await fs.rename(from, to);
        return { text: `Moved ${from} → ${to}.`, mutated: true };
      }

      case "copy_path": {
        if (!fullAccess)
          return { text: "Error: copy_path requires High access level." };
        const from = safe(base, String(input.from), true);
        const to = safe(base, String(input.to), true);
        await fs.mkdir(dirname(to), { recursive: true });
        await fs.cp(from, to, { recursive: true });
        return { text: `Copied ${from} → ${to}.`, mutated: true };
      }

      default:
        return { text: `Error: unknown tool "${name}".` };
    }
  } catch (err) {
    // Never expose raw ENOENT/EPERM stack text to the agent: a structured Retry
    // makes it verify paths and prevents read/create/edit loops on wrong names.
    return { text: friendlyFileToolError(name, input, err) };
  }
}

async function runRemoteTool(
  root: string,
  name: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const r = parseRemote(root);
  if (!r) return { text: "Error: bad remote root." };
  const conn = await ensureRemote(r.id);
  if (!conn) return { text: "Error: remote host is not connected." };

  const resolveRemote = (p: string): string => {
    if (p.startsWith("/")) return p;
    return `${r.path.replace(/\/$/, "")}/${p}`.replace(/\/\.\//g, "/");
  };

  try {
    switch (name) {
      case "read_file": {
        const abs = resolveRemote(String(input.path));
        const content = await remoteSftp.readFile(conn.sftp, abs);
        return {
          text:
            content.length > 60_000
              ? withLineNumbers(content.slice(0, 60_000))
              : withLineNumbers(content),
        };
      }
      case "write_file": {
        const abs = resolveRemote(String(input.path));
        const rel = String(input.path);
        const next = String(input.content ?? "");
        let prev = "";
        let existed = true;
        try {
          prev = await remoteSftp.readFile(conn.sftp, abs);
        } catch {
          existed = false;
        }
        await remoteSftp.writeFile(conn.sftp, abs, next);
        const meta = buildDiff(rel, prev, next, existed);
        return {
          text: `Wrote ${rel} (+${meta.added} -${meta.removed}).`,
          meta,
          mutated: true,
        };
      }
      case "edit_file": {
        const abs = resolveRemote(String(input.path));
        const rel = String(input.path);
        const oldStr = stripCopiedLineNumbers(String(input.old_str ?? ""));
        const newStr = String(input.new_str ?? "");
        const content = await remoteSftp.readFile(conn.sftp, abs);
        if (oldStr === "") {
          return { text: "Retry: old_str was empty. Read the file and retry with the exact target text." };
        }
        const count = content.split(oldStr).length - 1;
        if (count === 0) {
          return { text: `Retry: target text was not found in ${rel}. Read the latest file contents, then retry the edit.` };
        }
        if (count > 1) {
          return { text: `Retry: target text appears ${count} times in ${rel}. Read the file and include more surrounding lines so the edit is unique.` };
        }
        const next = content.replace(oldStr, newStr);
        await remoteSftp.writeFile(conn.sftp, abs, next);
        const meta = buildDiff(rel, content, next, true);
        return {
          text: `Edited ${rel} (+${meta.added} -${meta.removed}).`,
          meta,
          mutated: true,
        };
      }
      case "list_dir": {
        const abs = resolveRemote(String(input.path ?? "."));
        const list = await remoteSftp.readDir(conn.sftp, abs);
        const lines = list.map((e) => (e.isDir ? `${e.name}/` : e.name));
        return { text: lines.join("\n") || "(empty)" };
      }
      case "create_dir": {
        const abs = resolveRemote(String(input.path));
        await remoteExec(r.id, `mkdir -p ${JSON.stringify(abs)}`);
        return { text: `Created ${input.path}.`, mutated: true };
      }
      case "delete_path": {
        const abs = resolveRemote(String(input.path));
        await remoteExec(r.id, `rm -rf ${JSON.stringify(abs)}`);
        return { text: `Deleted ${input.path}.`, mutated: true };
      }
      case "move_path": {
        const from = resolveRemote(String(input.from));
        const to = resolveRemote(String(input.to));
        await remoteExec(
          r.id,
          `mkdir -p $(dirname ${JSON.stringify(to)}) && mv ${JSON.stringify(from)} ${JSON.stringify(to)}`,
        );
        return { text: `Moved ${input.from} → ${input.to}.`, mutated: true };
      }
      case "copy_path": {
        const from = resolveRemote(String(input.from));
        const to = resolveRemote(String(input.to));
        await remoteExec(
          r.id,
          `mkdir -p $(dirname ${JSON.stringify(to)}) && cp -r ${JSON.stringify(from)} ${JSON.stringify(to)}`,
        );
        return { text: `Copied ${input.from} → ${input.to}.`, mutated: true };
      }
      case "search": {
        const q = String(input.query ?? "");
        const res = await remoteExec(
          r.id,
          `grep -rIn --line-number ${JSON.stringify(q)} . | head -n 100`,
          r.path,
        );
        return { text: res.stdout.trim() || "No matches." };
      }
      case "run_command": {
        const cmd = String(input.command ?? "");
        const res = await remoteExec(r.id, cmd, r.path);
        const out =
          `${res.stdout}${res.stderr ? `\n[stderr]\n${res.stderr}` : ""}`.trim();
        return { text: `exit ${res.code}\n${out}`.slice(0, 20_000) };
      }
      default:
        return {
          text: `Error: tool "${name}" is not supported on remote hosts.`,
        };
    }
  } catch (err) {
    return {
      text: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function buildDiff(
  path: string,
  before: string,
  after: string,
  existed: boolean,
): ToolMeta {
  const a = before === "" ? [] : before.split("\n");
  const b = after.split("\n");

  if (a.length * b.length > 4_000_000) {
    return {
      path,
      added: b.length,
      removed: a.length,
      diff: [...a.map((l) => `-${l}`), ...b.map((l) => `+${l}`)].join("\n"),
      before,
      after,
      existed,
    };
  }

  const m = a.length;
  const n = b.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const lines: string[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      lines.push(` ${a[i]}`);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push(`-${a[i]}`);
      removed++;
      i++;
    } else {
      lines.push(`+${b[j]}`);
      added++;
      j++;
    }
  }
  while (i < m) {
    lines.push(`-${a[i++]}`);
    removed++;
  }
  while (j < n) {
    lines.push(`+${b[j++]}`);
    added++;
  }

  let diff = lines.join("\n");
  if (diff.length > 8000) diff = diff.slice(0, 8000) + "\n…";
  return { path, added, removed, diff, before, after, existed };
}

async function searchProjectContext(
  root: string,
  scope: string,
  query: string,
  contextLines: number,
  maxResults: number,
): Promise<string[]> {
  const out: string[] = [];
  let scanned = 0;
  const needle = query.toLowerCase();
  const MAX_FILES = 4000;

  async function inspectFile(full: string): Promise<void> {
    if (out.length >= maxResults) return;
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile() || stat.size > 500_000) return;
      const lines = (await fs.readFile(full, "utf8")).split("\n");
      const rel = relative(root, full);
      for (let index = 0; index < lines.length && out.length < maxResults; index++) {
        if (!lines[index].toLowerCase().includes(needle)) continue;
        const from = Math.max(0, index - contextLines);
        const to = Math.min(lines.length, index + contextLines + 1);
        const excerpt = lines.slice(from, to).map((line, offset) => {
          const lineNo = from + offset + 1;
          return `${lineNo === index + 1 ? ">" : " "} ${String(lineNo).padStart(5)} | ${line}`;
        }).join("\n");
        out.push(`${rel}:${index + 1}\n${excerpt}`);
      }
    } catch { /* unreadable/binary files are skipped */ }
  }

  async function walk(dir: string, depth: number): Promise<void> {
    if (out.length >= maxResults || scanned >= MAX_FILES || depth > 12) return;
    let entries: import("node:fs").Dirent[] = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (out.length >= maxResults || scanned >= MAX_FILES) return;
      if (IGNORED.has(entry.name) || (entry.name.startsWith(".") && entry.isDirectory())) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else { scanned++; await inspectFile(full); }
    }
  }

  const stat = await fs.stat(scope).catch(() => null);
  if (!stat) return out;
  if (stat.isDirectory()) await walk(scope, 0);
  else await inspectFile(scope);
  return out;
}

function runCommand(root: string, command: string): Promise<string> {
  return new Promise((resolvePromise) => {
    exec(
      command,
      {
        cwd: root,
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof error.code === "number" ? error.code : error ? 1 : 0;
        const parts: string[] = [`exit code: ${code}`];
        const out = stdout.toString().trim();
        const err = stderr.toString().trim();
        if (out) parts.push(`stdout:\n${out.slice(0, 20_000)}`);
        if (err) parts.push(`stderr:\n${err.slice(0, 20_000)}`);
        if (!out && !err) parts.push("(no output)");
        resolvePromise(parts.join("\n"));
      },
    );
  });
}

export async function readProjectSteering(
  root: string,
): Promise<{ primary: string; others: string }> {
  if (!root) return { primary: "", others: "" };
  const steeringDir = join(root, ".crab", "steering");
  let primary = "";
  const otherParts: string[] = [];

  try {
    const top = (
      await fs.readFile(join(root, ".crab", "CRAB.md"), "utf8")
    ).trim();
    if (top) primary = top;
  } catch {}

  async function walk(d: string): Promise<void> {
    let entries: import("node:fs").Dirent[] = [];
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (/\.md$/i.test(e.name)) {
        try {
          const content = (await fs.readFile(full, "utf8")).trim();
          if (!content) continue;
          if (e.name.toLowerCase() === "crab.md") {
            primary = content;
          } else {
            const rel = relative(steeringDir, full).replace(/\\/g, "/");
            otherParts.push(`### ${rel}\n${content}`);
          }
        } catch {}
      }
    }
  }

  await walk(steeringDir);
  return { primary, others: otherParts.join("\n\n") };
}

export async function readProjectMemory(root: string): Promise<string> {
  if (!root) return "";
  try {
    return (await fs.readFile(join(root, ".crab", "MEMORY.md"), "utf8")).trim();
  } catch {
    return "";
  }
}

export async function appendProjectMemory(
  root: string,
  note: string,
): Promise<void> {
  if (!root) return;
  const dir = join(root, ".crab");
  const file = join(dir, "MEMORY.md");
  await fs.mkdir(dir, { recursive: true });
  let existing = "";
  try {
    existing = await fs.readFile(file, "utf8");
  } catch {
    existing =
      "# Project memory\n\nDurable notes the agent keeps across sessions.\n";
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const line = `- (${stamp}) ${note.trim()}\n`;
  await fs.writeFile(file, `${existing.replace(/\s*$/, "")}\n${line}`, "utf8");
}

async function runGitTimeTravel(
  root: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const action = String(input.action ?? "");
  const q = (s: unknown): string => String(s ?? "").replace(/"/g, '\\"');

  const check = await runCommand(root, "git rev-parse --is-inside-work-tree");
  if (!/true/.test(check)) {
    return {
      text: "Error: not a git repository (git_time_travel needs git history).",
    };
  }

  let cmd: string;
  switch (action) {
    case "log":
      cmd = input.path
        ? `git log --oneline -n 30 -- "${q(input.path)}"`
        : "git log --oneline -n 30";
      break;
    case "search": {
      const term = q(input.query);
      if (!term) return { text: 'Error: "search" needs a query.' };
      cmd = `git log --oneline -n 30 -S"${term}" || git log --oneline -n 30 -G"${term}"`;
      break;
    }
    case "show": {
      const ref = q(input.ref);
      if (!ref) return { text: 'Error: "show" needs a commit ref.' };
      cmd = `git show --stat --patch ${ref}`;
      break;
    }
    case "blame": {
      const path = q(input.path);
      if (!path) return { text: 'Error: "blame" needs a path.' };
      cmd = `git blame -L 1,80 --date=short "${path}"`;
      break;
    }
    case "diff": {
      const ref = q(input.ref);
      const ref2 = q(input.ref2) || "HEAD";
      if (!ref) return { text: 'Error: "diff" needs a base ref.' };
      cmd = `git diff ${ref}..${ref2}`;
      break;
    }
    case "bisect_log": {
      const good = q(input.good);
      const bad = q(input.bad) || "HEAD";
      if (!good) return { text: 'Error: "bisect_log" needs a good ref.' };
      cmd = `git log --oneline ${good}..${bad}`;
      break;
    }
    default:
      return { text: `Error: unknown git_time_travel action "${action}".` };
  }

  const out = await runCommand(root, cmd);
  return { text: out.slice(0, 16_000) };
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function webSearch(query: string): Promise<string> {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        },
      },
    );
    if (!res.ok) return `Search failed (HTTP ${res.status}).`;
    const html = await res.text();

    const results: string[] = [];
    const linkRe =
      /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRe =
      /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

    const links: { url: string; title: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null && links.length < 8) {
      let url = m[1];
      const ud = url.match(/[?&]uddg=([^&]+)/);
      if (ud) url = decodeURIComponent(ud[1]);
      links.push({ url, title: htmlToText(m[2]) });
    }
    const snippets: string[] = [];
    while ((m = snippetRe.exec(html)) !== null && snippets.length < 8) {
      snippets.push(htmlToText(m[1]));
    }

    for (let i = 0; i < links.length; i++) {
      results.push(
        `${i + 1}. ${links[i].title}\n   ${links[i].url}\n   ${snippets[i] ?? ""}`.trimEnd(),
      );
    }
    return results.length ? results.join("\n\n") : "No results.";
  } catch (err) {
    return `Search error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function fetchUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });
    if (!res.ok) return `Fetch failed (HTTP ${res.status}).`;
    const ct = res.headers.get("content-type") ?? "";
    const body = await res.text();
    const text = ct.includes("html") ? htmlToText(body) : body;
    return text.slice(0, 12_000);
  } catch (err) {
    return `Fetch error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function openApp(name: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    let cmd: string;
    if (process.platform === "win32") {
      cmd = `start "" "${name}"`;
    } else if (process.platform === "darwin") {
      cmd = `open -a "${name}"`;
    } else {
      cmd = `${name} &`;
    }
    exec(cmd, { windowsHide: true }, (err) => {
      if (err) reject(err);
      else resolvePromise();
    });
  });
}

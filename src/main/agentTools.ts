<<<<<<< HEAD
import { promises as fs } from 'node:fs'
import { resolve, relative, join, isAbsolute, dirname } from 'node:path'
import { homedir } from 'node:os'
import { exec } from 'node:child_process'
import { shell } from 'electron'
import { addSkillFromUrl, addSkillFromRepo, listRepoSkills, createSkill, listSkills } from './skills'
import { browserNavigate, browserCapture } from './browser'
import { describeImage, activeModelHasVision } from './vision'
import { addMcpServer, listMcpServers } from './mcp'
import { connectGithub, getGithubAuth, commitAndPush } from './github'
=======
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
>>>>>>> baf0023 (release: CrabCode 0.2.8)
import {
  isRemotePath,
  parseRemote,
  ensureRemote,
  remoteSftp,
<<<<<<< HEAD
  remoteExec
} from './remote'


export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolMeta {
  path: string
  added: number
  removed: number
  diff: string
  before: string
  existed: boolean
}

export interface ToolResult {
  text: string
  meta?: ToolMeta
  command?: string
  mutated?: boolean
  image?: { mimeType: string; dataUrl: string }
=======
  remoteExec,
} from "./remote";
import { searchProjectIndex } from "./projectIndex";

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
  existed: boolean;
}

export interface ToolResult {
  text: string;
  meta?: ToolMeta;
  command?: string;
  mutated?: boolean;
  image?: { mimeType: string; dataUrl: string };
>>>>>>> baf0023 (release: CrabCode 0.2.8)
}

export const TOOL_DEFS: ToolDef[] = [
  {
<<<<<<< HEAD
    name: 'read_file',
    description:
      'Read a UTF-8 text file inside the project. Returns the content with 1-based line numbers. Use before editing.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project-relative path to the file.' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description:
      'Create a new file or overwrite an existing one with the given content. Parent directories are created automatically.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project-relative file path.' },
        content: { type: 'string', description: 'Full file content to write.' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'edit_file',
    description:
      'Replace an exact substring in a file. `old_str` must appear exactly once. Prefer this over write_file for small changes.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project-relative file path.' },
        old_str: { type: 'string', description: 'Exact text to find (must be unique).' },
        new_str: { type: 'string', description: 'Replacement text.' }
      },
      required: ['path', 'old_str', 'new_str']
    }
  },
  {
    name: 'list_dir',
    description: 'List the immediate entries of a directory inside the project.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project-relative directory path. Use "." for the root.' }
      },
      required: ['path']
    }
  },
  {
    name: 'create_dir',
    description: 'Create a directory (recursively) inside the project.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project-relative directory path.' }
      },
      required: ['path']
    }
  },
  {
    name: 'delete_path',
    description: 'Delete a file or directory (recursively) inside the project.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project-relative path to remove.' }
      },
      required: ['path']
    }
  },
  {
    name: 'search',
    description:
      'Search file names AND text content for a query string. Returns matching files with the first matching line.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Case-insensitive substring to search for.' }
      },
      required: ['query']
    }
  },
  {
    name: 'run_command',
    description:
      'Run a shell command in the project root and return stdout, stderr and the exit code. Use for builds, tests, git, package managers, scaffolding.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute.' }
      },
      required: ['command']
    }
  },
  {
    name: 'propose_command',
    description:
      'Propose a command for the USER to run in the embedded terminal (e.g. "npm run dev", "npm start"). ' +
      'Use this for long-running / interactive commands (dev servers, watchers) or when you want the user to ' +
      'review and run it themselves. It is shown as a card with a Run button; it does NOT execute automatically.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to propose.' },
        explanation: { type: 'string', description: 'Short note on what it does (optional).' }
      },
      required: ['command']
    }
  },
  {
    name: 'web_search',
    description:
      'Search the web and return top results (title, url, snippet). Use when the user asks to look something up online or you need current information.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query.' }
      },
      required: ['query']
    }
  },
  {
    name: 'fetch_url',
    description: 'Fetch a web page and return its readable text content (truncated).',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Absolute https URL to fetch.' }
      },
      required: ['url']
    }
  },
  {
    name: 'open_path',
    description:
      'HIGH ACCESS ONLY. Open a file, folder, application or URL with the OS default handler ' +
      '(e.g. open a website in the browser, launch an app, reveal a folder). Use for "open Gmail", ' +
      '"open my calendar", "launch X".',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'A URL, absolute file/folder path, or app name.' }
      },
      required: ['target']
    }
  },
  {
    name: 'move_path',
    description:
      'HIGH ACCESS ONLY. Move or rename a file/folder. Works across the whole machine (absolute paths).',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Source path.' },
        to: { type: 'string', description: 'Destination path.' }
      },
      required: ['from', 'to']
    }
  },
  {
    name: 'copy_path',
    description:
      'HIGH ACCESS ONLY. Copy a file/folder (recursively). Works across the whole machine (absolute paths). ' +
      'Use to copy a project from one folder into another.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Source path.' },
        to: { type: 'string', description: 'Destination path.' }
      },
      required: ['from', 'to']
    }
  },
  {
    name: 'add_skill',
    description:
      'Install one or more skills from GitHub. Three ways to call it: ' +
      '(1) url = a direct link to a SKILL.md file, a folder, or a repo root that has SKILL.md at the top. ' +
      '(2) url = a repository (e.g. https://github.com/anthropics/skills) PLUS a `skills` array of names — ' +
      'each is fetched from `skills/<name>/SKILL.md` inside that repo. This is exactly what ' +
      '`npx skills add <repo> --skill <name> --skill <name>` means. ' +
      '(3) url = a repository with NO `skills` array — lists the skills available in that repo so you ' +
      'can show the user what they can install. Installed skills are saved under .crab/skills/<name>/ and ' +
      'become /<name> slash commands.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'GitHub URL to a SKILL.md file, a folder, or a repository.' },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional: when url is a repo, the specific skill names to install (the --skill values), ' +
            'e.g. ["frontend-design", "pdf"]. Omit to list what the repo offers.'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'create_skill',
    description:
      'CREATE a brand-new skill and install it locally (no GitHub needed). A skill is a reusable ' +
      'SKILL.md with frontmatter (name, description) and step-by-step instructions. Use this when the ' +
      'user asks to "make/create a skill" for some task. After creating, it becomes a /<name> slash ' +
      'command immediately. Write clear, practical, progressive instructions in `body` (Markdown).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short skill id (kebab-case), e.g. "release-notes".' },
        description: { type: 'string', description: 'One-line summary of what the skill does.' },
        body: {
          type: 'string',
          description:
            'The SKILL.md instructions in Markdown (the part after the frontmatter). Include a title, ' +
            'when to use it, and concrete numbered steps. Frontmatter is added automatically if omitted.'
        }
      },
      required: ['name', 'description', 'body']
    }
  },
  {
    name: 'list_skills',
    description:
      'List installed skills, OR (when `repo` is given) the skills available inside a GitHub repository ' +
      'so you can tell the user what they can install with add_skill. Use the repo form to answer ' +
      '"what skills are in <repo>?".',
    parameters: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Optional GitHub repo URL to inspect (e.g. https://github.com/anthropics/skills).'
        }
      }
    }
  },
  {
    name: 'read_memory',
    description:
      'Read the project\'s persistent local memory (.crab/MEMORY.md). This is private, on-disk knowledge ' +
      'the agent keeps across sessions: user preferences, decisions, conventions, gotchas. It is already ' +
      'injected into your context at the start, but use this to re-read the latest after writing.',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'write_memory',
    description:
      'Append a durable note to the project\'s local memory (.crab/MEMORY.md). Use when you learn something ' +
      'worth remembering for future sessions: the user\'s preferences, project conventions, architecture ' +
      'decisions, recurring pitfalls. Keep notes short and factual. Stored locally, never uploaded.',
    parameters: {
      type: 'object',
      properties: {
        note: { type: 'string', description: 'A concise fact to remember (one or two sentences).' }
      },
      required: ['note']
    }
  },
  {
    name: 'git_time_travel',
    description:
      'Investigate WHEN and WHY something changed using git history. Actions: ' +
      '"log" (recent commits), "search" (find commits whose diff touches a string/regex via pickaxe), ' +
      '"show" (full diff of a commit), "blame" (who last changed a file region), ' +
      '"diff" (changes between two refs), "bisect_log" (commits between a good and bad ref to locate a regression). ' +
      'Use this to find the commit that introduced a bug, then read the code and fix it.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['log', 'search', 'show', 'blame', 'diff', 'bisect_log'],
          description: 'Which git investigation to run.'
        },
        query: { type: 'string', description: 'For "search": text/regex to find in diffs (pickaxe -S/-G).' },
        path: { type: 'string', description: 'For "blame"/"log": limit to this file.' },
        ref: { type: 'string', description: 'For "show": commit hash. For "diff": base ref.' },
        ref2: { type: 'string', description: 'For "diff": target ref (default HEAD).' },
        good: { type: 'string', description: 'For "bisect_log": last known-good ref.' },
        bad: { type: 'string', description: 'For "bisect_log": known-bad ref (default HEAD).' }
      },
      required: ['action']
    }
  },
  {
    name: 'browser_open',
    description:
      'Open the in-editor browser (the agent\'s "eyes") and navigate to a URL. Use this to look at a ' +
      'running dev server, documentation, a design, or any web page you need to SEE. After opening, ' +
      'use browser_read to get the page text or browser_screenshot to see it visually.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open (https). A bare domain or query also works.' }
      },
      required: ['url']
    }
  },
  {
    name: 'browser_read',
    description:
      'Read the readable text of the page currently shown in the in-editor browser (or the user\'s ' +
      'selection if any). Open a page first with browser_open. Returns the visible text content.',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'browser_screenshot',
    description:
      'Capture a screenshot of the page currently shown in the in-editor browser and SEE it: the ' +
      'image is returned to you so you can visually judge layout, colors, typography and spacing. ' +
      'Open a page first with browser_open.',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'list_mcp_servers',
    description:
      'List the configured MCP servers and their status (enabled/disabled, transport, command/url). ' +
      'Use when the user runs /mcp or asks which MCP servers are set up.',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'add_mcp_server',
    description:
      'Connect (register) an MCP server for the user from chat. Use when the user asks to add/connect ' +
      'an MCP server. Two transports: "stdio" (a local command, e.g. npx a package) or "http"/"sse" ' +
      '(a remote endpoint URL). Provide a short name. For stdio set command (+ optional args/env); for ' +
      'http/sse set url (+ optional headers). The server is saved and enabled.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short identifier for the server (e.g. "github", "fetch").' },
        transport: {
          type: 'string',
          enum: ['stdio', 'http', 'sse'],
          description: 'stdio = local command; http/sse = remote endpoint.'
        },
        command: { type: 'string', description: 'stdio: executable to launch (e.g. "npx").' },
        args: { type: 'array', items: { type: 'string' }, description: 'stdio: command arguments.' },
        env: { type: 'object', description: 'stdio: environment variables (KEY: value).' },
        url: { type: 'string', description: 'http/sse: the endpoint URL.' },
        headers: { type: 'object', description: 'http/sse: request headers (e.g. Authorization).' }
      },
      required: ['name', 'transport']
    }
  },
  {
    name: 'github_connect',
    description:
      'Connect the user\'s GitHub account using a Personal Access Token (PAT) they paste in chat. ' +
      'Use when the user asks to "connect GitHub" and provides a token (ghp_... or github_pat_...). ' +
      'Validates and securely stores the token. After this, commits/pushes work.',
    parameters: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'The GitHub Personal Access Token to connect with.' }
      },
      required: ['token']
    }
  },
  {
    name: 'github_status',
    description:
      'Check whether GitHub is connected (and as which user). Use before committing to decide if you ' +
      'need to ask the user for a token first.',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'github_commit',
    description:
      'Commit and push changes in the current GitHub project. Use when the user says "commit all", ' +
      '"commit this file", etc. Requires GitHub to be connected — if not, ask the user for a token ' +
      'and call github_connect first. Stages all changes, or only the given paths, then pushes.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Commit message.' },
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: project-relative file paths to commit. Omit to commit everything.'
        }
      },
      required: ['message']
    }
  }
]

const IGNORED = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  '.next',
  '.cache',
  'target',
  'vendor',
  '.venv',
  '__pycache__'
])

function safe(root: string, p: string, fullAccess = false): string {
  const abs = isAbsolute(p) ? p : resolve(root, p)
  if (fullAccess) return abs
  const rel = relative(root, abs)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Path escapes the project root: ${p}`)
  }
  return abs
}

function withLineNumbers(content: string): string {
  const lines = content.split('\n')
  const width = String(lines.length).length
  return lines.map((l, i) => `${String(i + 1).padStart(width, ' ')}  ${l}`).join('\n')
=======
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
      "Create a new file or overwrite an existing one with the given content. Parent directories are created automatically.",
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
      "Replace an exact substring in a file. `old_str` must appear exactly once. Prefer this over write_file for small changes.",
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
      "Search the project index for files, symbols, imports and text content. Returns ranked matches with line numbers.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Case-insensitive substring to search for.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "run_command",
    description:
      "Run a shell command in the project root and return stdout, stderr and the exit code. Use for builds, tests, git, package managers, scaffolding.",
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
    name: "propose_command",
    description:
      'Propose a command for the USER to run in the embedded terminal (e.g. "npm run dev", "npm start"). ' +
      "Use this for long-running / interactive commands (dev servers, watchers) or when you want the user to " +
      "review and run it themselves. It is shown as a card with a Run button; it does NOT execute automatically.",
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
      "Search the web and return top results (title, url, snippet). Use when the user asks to look something up online or you need current information.",
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
      "Fetch a web page and return its readable text content (truncated).",
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
      "http/sse set url (+ optional headers). The server is saved and enabled.",
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
      },
      required: ["name", "transport"],
    },
  },
  {
    name: "github_connect",
    description:
      "Connect the user's GitHub account using a Personal Access Token (PAT) they paste in chat. " +
      'Use when the user asks to "connect GitHub" and provides a token (ghp_... or github_pat_...). ' +
      "Validates and securely stores the token. After this, commits/pushes work.",
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
>>>>>>> baf0023 (release: CrabCode 0.2.8)
}

export async function runTool(
  root: string,
  name: string,
  input: Record<string, unknown>,
<<<<<<< HEAD
  access: 'normal' | 'high' = 'normal',
  editMode: 'auto' | 'ask' | 'readonly' = 'auto'
): Promise<ToolResult> {
  const MUTATING = new Set([
    'write_file',
    'edit_file',
    'create_dir',
    'delete_path',
    'move_path',
    'copy_path'
  ])
  if (editMode === 'readonly' && MUTATING.has(name)) {
    return { text: `Error: edit mode is Read Only — "${name}" is not allowed.` }
  }

  if (isRemotePath(root)) {
    return runRemoteTool(root, name, input)
  }

  const fullAccess = access === 'high'
  if (!root && !fullAccess) {
    return { text: 'Error: no project folder is open. Ask the user to open a folder first.' }
  }
  const base = root || homedir()

  try {
    switch (name) {
      case 'read_file': {
        const abs = safe(base, String(input.path), fullAccess)
        const content = await fs.readFile(abs, 'utf8')
=======
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
>>>>>>> baf0023 (release: CrabCode 0.2.8)
        if (content.length > 60_000) {
          return {
            text:
              `File is large (${content.length} chars). First 60000 chars:\n` +
<<<<<<< HEAD
              withLineNumbers(content.slice(0, 60_000))
          }
        }
        return { text: withLineNumbers(content) }
      }

      case 'write_file': {
        const abs = safe(base, String(input.path), fullAccess)
        const rel = String(input.path)
        const next = String(input.content ?? '')
        let prev = ''
        let existed = true
        try {
          prev = await fs.readFile(abs, 'utf8')
        } catch {
          prev = ''
          existed = false
        }
        await fs.mkdir(dirname(abs), { recursive: true })
        await fs.writeFile(abs, next, 'utf8')
        const meta = buildDiff(rel, prev, next, existed)
        return { text: `Wrote ${rel} (+${meta.added} -${meta.removed}).`, meta, mutated: true }
      }

      case 'edit_file': {
        const abs = safe(base, String(input.path), fullAccess)
        const rel = String(input.path)
        const oldStr = String(input.old_str ?? '')
        const newStr = String(input.new_str ?? '')
        const content = await fs.readFile(abs, 'utf8')
        const count = content.split(oldStr).length - 1
        if (oldStr === '') return { text: 'Error: old_str must not be empty.' }
        if (count === 0) return { text: `Error: old_str not found in ${rel}.` }
        if (count > 1) {
          return { text: `Error: old_str appears ${count} times in ${rel}; make it unique.` }
        }
        const next = content.replace(oldStr, newStr)
        await fs.writeFile(abs, next, 'utf8')
        const meta = buildDiff(rel, content, next, true)
        return { text: `Edited ${rel} (+${meta.added} -${meta.removed}).`, meta, mutated: true }
      }

      case 'list_dir': {
        const abs = safe(base, String(input.path ?? '.'), fullAccess)
        const entries = await fs.readdir(abs, { withFileTypes: true })
        const list = entries
          .filter((e) => !IGNORED.has(e.name))
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .sort()
        return { text: list.length ? list.join('\n') : '(empty)' }
      }

      case 'create_dir': {
        const abs = safe(base, String(input.path), fullAccess)
        await fs.mkdir(abs, { recursive: true })
        return { text: `Created directory ${String(input.path)}.`, mutated: true }
      }

      case 'delete_path': {
        const abs = safe(base, String(input.path), fullAccess)
        await fs.rm(abs, { recursive: true, force: true })
        return { text: `Deleted ${String(input.path)}.`, mutated: true }
      }

      case 'search': {
        const q = String(input.query ?? '').toLowerCase()
        if (!q) return { text: 'Error: empty query.' }
        const hits = await searchProject(base, q)
        return { text: hits.length ? hits.join('\n') : 'No matches.' }
      }

      case 'run_command': {
        const command = String(input.command ?? '')
        if (!command.trim()) return { text: 'Error: empty command.' }
        return { text: await runCommand(base, command) }
      }

      case 'propose_command': {
        const command = String(input.command ?? '').trim()
        if (!command) return { text: 'Error: empty command.' }
        const note = String(input.explanation ?? '').trim()
        return {
          text:
            `Proposed command for the user to run: \`${command}\`.` +
            (note ? ` (${note})` : '') +
            ' The user can run it from the chat with one click.',
          command
        }
      }

      case 'web_search': {
        const query = String(input.query ?? '').trim()
        if (!query) return { text: 'Error: empty query.' }
        return { text: await webSearch(query) }
      }

      case 'fetch_url': {
        const url = String(input.url ?? '').trim()
        if (!/^https?:\/\//i.test(url)) return { text: 'Error: provide an absolute http(s) URL.' }
        return { text: await fetchUrl(url) }
      }

      case 'add_skill': {
        const url = String(input.url ?? '').trim()
        const names = Array.isArray(input.skills) ? input.skills.map((s) => String(s).trim()).filter(Boolean) : []

        if (names.length > 0) {
          const done: string[] = []
          const failed: string[] = []
          for (const n of names) {
            const r = await addSkillFromRepo(root, url, n)
            if (r.ok) done.push(`/${r.name}`)
            else failed.push(`${n} (${r.error})`)
          }
          const parts: string[] = []
          if (done.length) parts.push(`Installed: ${done.join(', ')}. They are available as slash commands.`)
          if (failed.length) parts.push(`Failed: ${failed.join('; ')}.`)
          return { text: parts.join(' ') || 'Nothing installed.', mutated: done.length > 0 }
        }

        const looksLikeRepoRoot = /github\.com\/[^/]+\/[^/?#]+\/?($|\?|#)/i.test(url) &&
          !/\/(blob|tree)\//i.test(url) && !/SKILL\.md$/i.test(url)
        const direct = await addSkillFromUrl(root, url)
        if (direct.ok) {
          return {
            text:
              `Installed skill "/${direct.name}"${direct.description ? ` — ${direct.description}` : ''}. ` +
              `Read .crab/skills/${direct.name}/SKILL.md to use it.`,
            mutated: true
          }
        }
        if (looksLikeRepoRoot) {
          const listed = await listRepoSkills(url)
=======
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
        const oldStr = String(input.old_str ?? "");
        const newStr = String(input.new_str ?? "");
        const content = await fs.readFile(abs, "utf8");
        const count = content.split(oldStr).length - 1;
        if (oldStr === "") return { text: "Error: old_str must not be empty." };
        if (count === 0) return { text: `Error: old_str not found in ${rel}.` };
        if (count > 1) {
          return {
            text: `Error: old_str appears ${count} times in ${rel}; make it unique.`,
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
        const q = String(input.query ?? "").toLowerCase();
        if (!q) return { text: "Error: empty query." };
        const indexedHits = await searchProjectIndex(base, q);
        const hits = indexedHits.length
          ? indexedHits
          : await searchProject(base, q);
        return { text: hits.length ? hits.join("\n") : "No matches." };
      }

      case "run_command": {
        const command = String(input.command ?? "");
        if (!command.trim()) return { text: "Error: empty command." };
        return { text: await runCommand(base, command) };
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
>>>>>>> baf0023 (release: CrabCode 0.2.8)
          if (listed.ok && listed.skills?.length) {
            return {
              text:
                `That repo doesn't have a SKILL.md at its root, but it offers these skills:\n` +
<<<<<<< HEAD
                listed.skills.map((s) => `- ${s}`).join('\n') +
                `\n\nInstall one with add_skill { url, skills: ["<name>"] }.`
            }
          }
        }
        return { text: `Error: ${direct.error}` }
      }

      case 'create_skill': {
        const name = String(input.name ?? '').trim()
        const description = String(input.description ?? '').trim()
        const body = String(input.body ?? '')
        if (!name) return { text: 'Error: provide a skill name.' }
        if (!body.trim()) return { text: 'Error: provide the SKILL.md body (instructions).' }
        const r = await createSkill(root, name, description, body)
        if (!r.ok) return { text: `Error: ${r.error}` }
        return {
          text:
            `Created skill "/${r.name}"${r.description ? ` — ${r.description}` : ''}. ` +
            `Saved to .crab/skills/${r.name}/SKILL.md and available as the /${r.name} command.`,
          mutated: true
        }
      }

      case 'list_skills': {
        const repo = String(input.repo ?? '').trim()
        if (repo) {
          const listed = await listRepoSkills(repo)
          if (!listed.ok) return { text: `Error: ${listed.error}` }
          return {
            text:
              `Skills available in ${repo}:\n` +
              (listed.skills ?? []).map((s) => `- ${s}`).join('\n') +
              `\n\nInstall with add_skill { url: "${repo}", skills: ["<name>"] }.`
          }
        }
        const skills = await listSkills(root)
        if (skills.length === 0) return { text: 'No skills installed yet.' }
        return {
          text:
            'Installed skills:\n' +
            skills.map((s) => `- /${s.name}: ${s.description || '(no description)'}`).join('\n')
        }
      }

      case 'read_memory': {
        const text = await readProjectMemory(base)
        return { text: text || '(memory is empty)' }
      }

      case 'write_memory': {
        const note = String(input.note ?? '').trim()
        if (!note) return { text: 'Error: empty note.' }
        await appendProjectMemory(base, note)
        return { text: `Saved to memory: ${note}`, mutated: true }
      }

      case 'git_time_travel': {
        return runGitTimeTravel(base, input)
      }

      case 'browser_open': {
        const url = String(input.url ?? '').trim()
        if (!url) return { text: 'Error: empty url.' }
        browserNavigate(url)
        return {
          text: `Opened the in-editor browser at ${url}. Use browser_read for text or browser_screenshot to see it.`
        }
      }

      case 'browser_read': {
        const res = await browserCapture('text')
        if (!res.ok) return { text: `Error: ${res.error ?? 'could not read page'}` }
        return {
          text: `Page: ${res.title ?? ''} (${res.url ?? ''})\n\n${(res.data ?? '').slice(0, 12000)}`
        }
      }

      case 'browser_screenshot': {
        const res = await browserCapture('screenshot')
        if (!res.ok) return { text: `Error: ${res.error ?? 'could not capture page'}` }
        const where = `${res.url ?? 'the page'}${res.title ? ` — ${res.title}` : ''}`
        if (activeModelHasVision()) {
          return {
            text: `Screenshot of ${where}. Look at the image to judge the layout and visual style.`,
            image: res.data ? { mimeType: 'image/png', dataUrl: res.data } : undefined
          }
        }
        const description = res.data ? await describeImage(res.data) : null
        if (description) {
          return {
            text: `Screenshot of ${where}. Visual description (from the vision model):\n\n${description}`
          }
        }
        return {
          text: `Screenshot of ${where}. (No vision model is connected to describe it; rely on browser_read for the page structure.)`,
          image: res.data ? { mimeType: 'image/png', dataUrl: res.data } : undefined
        }
      }

      case 'list_mcp_servers': {
        const servers = listMcpServers()
        if (servers.length === 0) {
          return { text: 'No MCP servers configured yet.' }
        }
        const lines = servers.map((s) => {
          const status = s.enabled ? 'enabled' : 'disabled'
          const detail =
            s.transport === 'stdio'
              ? `stdio: ${s.command ?? ''} ${(s.args ?? []).join(' ')}`.trim()
              : `${s.transport}: ${s.url ?? ''}`
          return `- ${s.name} [${status}] — ${detail}`
        })
        return { text: `MCP servers (${servers.length}):\n${lines.join('\n')}` }
      }

      case 'add_mcp_server': {
        const name = String(input.name ?? '').trim()
        const transport = String(input.transport ?? 'stdio') as 'stdio' | 'http' | 'sse'
        if (!name) return { text: 'Error: provide a server name.' }
        if (transport === 'stdio') {
          const command = String(input.command ?? '').trim()
          if (!command) return { text: 'Error: stdio transport requires a "command".' }
          const args = Array.isArray(input.args) ? input.args.map(String) : []
          const env =
            input.env && typeof input.env === 'object'
              ? (input.env as Record<string, string>)
              : {}
          const saved = addMcpServer({ name, transport, command, args, env, enabled: true })
          return {
            text: `Connected MCP server "${saved.name}" (stdio: ${command} ${args.join(' ')}). It is enabled and saved.`,
            mutated: true
          }
        } else {
          const url = String(input.url ?? '').trim()
          if (!url) return { text: `Error: ${transport} transport requires a "url".` }
          const headers =
            input.headers && typeof input.headers === 'object'
              ? (input.headers as Record<string, string>)
              : {}
          const saved = addMcpServer({ name, transport, url, headers, enabled: true })
          return {
            text: `Connected MCP server "${saved.name}" (${transport}: ${url}). It is enabled and saved.`,
            mutated: true
          }
        }
      }

      case 'github_connect': {
        const tk = String(input.token ?? '').trim()
        if (!tk) return { text: 'Error: no token provided. Ask the user to paste their GitHub token.' }
        const r = await connectGithub(tk)
        if (!r.ok) return { text: `Error connecting GitHub: ${r.error ?? 'failed'}` }
        return {
          text: `Connected GitHub as ${r.login ?? 'user'}. You can now commit and push.`,
          mutated: true
        }
      }

      case 'github_status': {
        const auth = getGithubAuth()
        return {
          text: auth.connected
            ? `GitHub is connected as ${auth.login ?? 'user'}.`
            : 'GitHub is NOT connected. Ask the user to paste a Personal Access Token, then call github_connect.'
        }
      }

      case 'github_commit': {
        const auth = getGithubAuth()
        if (!auth.connected) {
          return {
            text:
              'GitHub is not connected. Ask the user to paste a GitHub Personal Access Token, ' +
              'then call github_connect before committing.'
          }
        }
        if (!root) return { text: 'Error: no project is open.' }
        const message = String(input.message ?? '').trim() || 'Update from CrabCode'
        const paths = Array.isArray(input.paths) ? input.paths.map(String) : undefined
        const res = await commitAndPush({ path: root, message, paths })
        if (!res.ok) return { text: `Commit failed: ${res.error ?? 'unknown error'}` }
=======
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
        if (activeModelHasVision()) {
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
          text: `Screenshot of ${where}. (No vision model is connected to describe it; rely on browser_read for the page structure.)`,
          image: res.data
            ? { mimeType: "image/png", dataUrl: res.data }
            : undefined,
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
        const name = String(input.name ?? "").trim();
        const transport = String(input.transport ?? "stdio") as
          "stdio" | "http" | "sse";
        if (!name) return { text: "Error: provide a server name." };
        if (transport === "stdio") {
          const command = String(input.command ?? "").trim();
          if (!command)
            return { text: 'Error: stdio transport requires a "command".' };
          const args = Array.isArray(input.args) ? input.args.map(String) : [];
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
          const url = String(input.url ?? "").trim();
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
>>>>>>> baf0023 (release: CrabCode 0.2.8)
        return {
          text:
            paths && paths.length > 0
              ? `Committed and pushed ${paths.length} file(s) with message "${message}".`
              : `Committed and pushed all changes with message "${message}".`,
<<<<<<< HEAD
          mutated: true
        }
      }

      case 'open_path': {
        if (!fullAccess) return { text: 'Error: open_path requires High access level.' }
        const target = String(input.target ?? '').trim()
        if (!target) return { text: 'Error: empty target.' }
        try {
          if (/^https?:\/\//i.test(target)) {
            await shell.openExternal(target)
          } else if (isAbsolute(target)) {
            const err = await shell.openPath(target)
            if (err) return { text: `Could not open: ${err}` }
          } else {
            await openApp(target)
          }
          return { text: `Opened ${target}.` }
        } catch (err) {
          return { text: `Error: ${err instanceof Error ? err.message : String(err)}` }
        }
      }

      case 'move_path': {
        if (!fullAccess) return { text: 'Error: move_path requires High access level.' }
        const from = safe(base, String(input.from), true)
        const to = safe(base, String(input.to), true)
        await fs.mkdir(dirname(to), { recursive: true })
        await fs.rename(from, to)
        return { text: `Moved ${from} → ${to}.`, mutated: true }
      }

      case 'copy_path': {
        if (!fullAccess) return { text: 'Error: copy_path requires High access level.' }
        const from = safe(base, String(input.from), true)
        const to = safe(base, String(input.to), true)
        await fs.mkdir(dirname(to), { recursive: true })
        await fs.cp(from, to, { recursive: true })
        return { text: `Copied ${from} → ${to}.`, mutated: true }
      }

      default:
        return { text: `Error: unknown tool "${name}".` }
    }
  } catch (err) {
    return { text: `Error: ${err instanceof Error ? err.message : String(err)}` }
=======
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
    return {
      text: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
>>>>>>> baf0023 (release: CrabCode 0.2.8)
  }
}

async function runRemoteTool(
  root: string,
  name: string,
<<<<<<< HEAD
  input: Record<string, unknown>
): Promise<ToolResult> {
  const r = parseRemote(root)
  if (!r) return { text: 'Error: bad remote root.' }
  const conn = await ensureRemote(r.id)
  if (!conn) return { text: 'Error: remote host is not connected.' }

  const resolveRemote = (p: string): string => {
    if (p.startsWith('/')) return p
    return `${r.path.replace(/\/$/, '')}/${p}`.replace(/\/\.\//g, '/')
  }

  try {
    switch (name) {
      case 'read_file': {
        const abs = resolveRemote(String(input.path))
        const content = await remoteSftp.readFile(conn.sftp, abs)
=======
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
>>>>>>> baf0023 (release: CrabCode 0.2.8)
        return {
          text:
            content.length > 60_000
              ? withLineNumbers(content.slice(0, 60_000))
<<<<<<< HEAD
              : withLineNumbers(content)
        }
      }
      case 'write_file': {
        const abs = resolveRemote(String(input.path))
        const rel = String(input.path)
        const next = String(input.content ?? '')
        let prev = ''
        let existed = true
        try {
          prev = await remoteSftp.readFile(conn.sftp, abs)
        } catch {
          existed = false
        }
        await remoteSftp.writeFile(conn.sftp, abs, next)
        const meta = buildDiff(rel, prev, next, existed)
        return { text: `Wrote ${rel} (+${meta.added} -${meta.removed}).`, meta, mutated: true }
      }
      case 'edit_file': {
        const abs = resolveRemote(String(input.path))
        const rel = String(input.path)
        const oldStr = String(input.old_str ?? '')
        const newStr = String(input.new_str ?? '')
        const content = await remoteSftp.readFile(conn.sftp, abs)
        if (!content.includes(oldStr)) {
          return { text: `Error: old_str not found in ${rel}.` }
        }
        const next = content.replace(oldStr, newStr)
        await remoteSftp.writeFile(conn.sftp, abs, next)
        const meta = buildDiff(rel, content, next, true)
        return { text: `Edited ${rel} (+${meta.added} -${meta.removed}).`, meta, mutated: true }
      }
      case 'list_dir': {
        const abs = resolveRemote(String(input.path ?? '.'))
        const list = await remoteSftp.readDir(conn.sftp, abs)
        const lines = list.map((e) => (e.isDir ? `${e.name}/` : e.name))
        return { text: lines.join('\n') || '(empty)' }
      }
      case 'create_dir': {
        const abs = resolveRemote(String(input.path))
        await remoteExec(r.id, `mkdir -p ${JSON.stringify(abs)}`)
        return { text: `Created ${input.path}.`, mutated: true }
      }
      case 'delete_path': {
        const abs = resolveRemote(String(input.path))
        await remoteExec(r.id, `rm -rf ${JSON.stringify(abs)}`)
        return { text: `Deleted ${input.path}.`, mutated: true }
      }
      case 'move_path': {
        const from = resolveRemote(String(input.from))
        const to = resolveRemote(String(input.to))
        await remoteExec(r.id, `mkdir -p $(dirname ${JSON.stringify(to)}) && mv ${JSON.stringify(from)} ${JSON.stringify(to)}`)
        return { text: `Moved ${input.from} → ${input.to}.`, mutated: true }
      }
      case 'copy_path': {
        const from = resolveRemote(String(input.from))
        const to = resolveRemote(String(input.to))
        await remoteExec(r.id, `mkdir -p $(dirname ${JSON.stringify(to)}) && cp -r ${JSON.stringify(from)} ${JSON.stringify(to)}`)
        return { text: `Copied ${input.from} → ${input.to}.`, mutated: true }
      }
      case 'search': {
        const q = String(input.query ?? '')
        const res = await remoteExec(
          r.id,
          `grep -rIn --line-number ${JSON.stringify(q)} . | head -n 100`,
          r.path
        )
        return { text: res.stdout.trim() || 'No matches.' }
      }
      case 'run_command': {
        const cmd = String(input.command ?? '')
        const res = await remoteExec(r.id, cmd, r.path)
        const out = `${res.stdout}${res.stderr ? `\n[stderr]\n${res.stderr}` : ''}`.trim()
        return { text: `exit ${res.code}\n${out}`.slice(0, 20_000) }
      }
      default:
        return { text: `Error: tool "${name}" is not supported on remote hosts.` }
    }
  } catch (err) {
    return { text: `Error: ${err instanceof Error ? err.message : String(err)}` }
  }
}

function buildDiff(path: string, before: string, after: string, existed: boolean): ToolMeta {
  const a = before === '' ? [] : before.split('\n')
  const b = after.split('\n')
=======
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
        const oldStr = String(input.old_str ?? "");
        const newStr = String(input.new_str ?? "");
        const content = await remoteSftp.readFile(conn.sftp, abs);
        if (!content.includes(oldStr)) {
          return { text: `Error: old_str not found in ${rel}.` };
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
>>>>>>> baf0023 (release: CrabCode 0.2.8)

  if (a.length * b.length > 4_000_000) {
    return {
      path,
      added: b.length,
      removed: a.length,
<<<<<<< HEAD
      diff: [...a.map((l) => `-${l}`), ...b.map((l) => `+${l}`)].join('\n'),
      before,
      existed
    }
  }

  const m = a.length
  const n = b.length
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const lines: string[] = []
  let added = 0
  let removed = 0
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      lines.push(` ${a[i]}`)
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push(`-${a[i]}`)
      removed++
      i++
    } else {
      lines.push(`+${b[j]}`)
      added++
      j++
    }
  }
  while (i < m) {
    lines.push(`-${a[i++]}`)
    removed++
  }
  while (j < n) {
    lines.push(`+${b[j++]}`)
    added++
  }

  let diff = lines.join('\n')
  if (diff.length > 8000) diff = diff.slice(0, 8000) + '\n…'
  return { path, added, removed, diff, before, existed }
}

async function searchProject(root: string, q: string): Promise<string[]> {
  const out: string[] = []
  let scanned = 0
  const MAX = 4000

  async function walk(dir: string, depth: number): Promise<void> {
    if (out.length >= 50 || scanned >= MAX || depth > 12) return
    let entries: import('node:fs').Dirent[] = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (out.length >= 50 || scanned >= MAX) return
      if (IGNORED.has(e.name) || (e.name.startsWith('.') && e.isDirectory())) continue
      scanned++
      const full = join(dir, e.name)
      const rel = relative(root, full)
      if (e.isDirectory()) {
        await walk(full, depth + 1)
      } else {
        if (e.name.toLowerCase().includes(q)) {
          out.push(`${rel} (filename match)`)
          continue
        }
        try {
          const stat = await fs.stat(full)
          if (stat.size > 500_000) continue
          const content = await fs.readFile(full, 'utf8')
          const idx = content.toLowerCase().indexOf(q)
          if (idx >= 0) {
            const lineNo = content.slice(0, idx).split('\n').length
            const line = content.split('\n')[lineNo - 1]?.trim().slice(0, 120) ?? ''
            out.push(`${rel}:${lineNo}: ${line}`)
          }
        } catch {
        }
=======
      diff: [...a.map((l) => `-${l}`), ...b.map((l) => `+${l}`)].join("\n"),
      before,
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
  return { path, added, removed, diff, before, existed };
}

async function searchProject(root: string, q: string): Promise<string[]> {
  const out: string[] = [];
  let scanned = 0;
  const MAX = 4000;

  async function walk(dir: string, depth: number): Promise<void> {
    if (out.length >= 50 || scanned >= MAX || depth > 12) return;
    let entries: import("node:fs").Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= 50 || scanned >= MAX) return;
      if (IGNORED.has(e.name) || (e.name.startsWith(".") && e.isDirectory()))
        continue;
      scanned++;
      const full = join(dir, e.name);
      const rel = relative(root, full);
      if (e.isDirectory()) {
        await walk(full, depth + 1);
      } else {
        if (e.name.toLowerCase().includes(q)) {
          out.push(`${rel} (filename match)`);
          continue;
        }
        try {
          const stat = await fs.stat(full);
          if (stat.size > 500_000) continue;
          const content = await fs.readFile(full, "utf8");
          const idx = content.toLowerCase().indexOf(q);
          if (idx >= 0) {
            const lineNo = content.slice(0, idx).split("\n").length;
            const line =
              content.split("\n")[lineNo - 1]?.trim().slice(0, 120) ?? "";
            out.push(`${rel}:${lineNo}: ${line}`);
          }
        } catch {}
>>>>>>> baf0023 (release: CrabCode 0.2.8)
      }
    }
  }

<<<<<<< HEAD
  await walk(root, 0)
  return out
=======
  await walk(root, 0);
  return out;
>>>>>>> baf0023 (release: CrabCode 0.2.8)
}

function runCommand(root: string, command: string): Promise<string> {
  return new Promise((resolvePromise) => {
    exec(
      command,
<<<<<<< HEAD
      { cwd: root, timeout: 120_000, maxBuffer: 10 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        const code = error && typeof error.code === 'number' ? error.code : error ? 1 : 0
        const parts: string[] = [`exit code: ${code}`]
        const out = stdout.toString().trim()
        const err = stderr.toString().trim()
        if (out) parts.push(`stdout:\n${out.slice(0, 20_000)}`)
        if (err) parts.push(`stderr:\n${err.slice(0, 20_000)}`)
        if (!out && !err) parts.push('(no output)')
        resolvePromise(parts.join('\n'))
      }
    )
  })
}

export async function readProjectSteering(
  root: string
): Promise<{ primary: string; others: string }> {
  if (!root) return { primary: '', others: '' }
  const steeringDir = join(root, '.crab', 'steering')
  let primary = ''
  const otherParts: string[] = []

  try {
    const top = (await fs.readFile(join(root, '.crab', 'CRAB.md'), 'utf8')).trim()
    if (top) primary = top
  } catch {
  }

  async function walk(d: string): Promise<void> {
    let entries: import('node:fs').Dirent[] = []
    try {
      entries = await fs.readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const e of entries) {
      const full = join(d, e.name)
      if (e.isDirectory()) {
        await walk(full)
      } else if (/\.md$/i.test(e.name)) {
        try {
          const content = (await fs.readFile(full, 'utf8')).trim()
          if (!content) continue
          if (e.name.toLowerCase() === 'crab.md') {
            primary = content
          } else {
            const rel = relative(steeringDir, full).replace(/\\/g, '/')
            otherParts.push(`### ${rel}\n${content}`)
          }
        } catch {
        }
=======
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
>>>>>>> baf0023 (release: CrabCode 0.2.8)
      }
    }
  }

<<<<<<< HEAD
  await walk(steeringDir)
  return { primary, others: otherParts.join('\n\n') }
}


export async function readProjectMemory(root: string): Promise<string> {
  if (!root) return ''
  try {
    return (await fs.readFile(join(root, '.crab', 'MEMORY.md'), 'utf8')).trim()
  } catch {
    return ''
  }
}

export async function appendProjectMemory(root: string, note: string): Promise<void> {
  if (!root) return
  const dir = join(root, '.crab')
  const file = join(dir, 'MEMORY.md')
  await fs.mkdir(dir, { recursive: true })
  let existing = ''
  try {
    existing = await fs.readFile(file, 'utf8')
  } catch {
    existing = '# Project memory\n\nDurable notes the agent keeps across sessions.\n'
  }
  const stamp = new Date().toISOString().slice(0, 10)
  const line = `- (${stamp}) ${note.trim()}\n`
  await fs.writeFile(file, `${existing.replace(/\s*$/, '')}\n${line}`, 'utf8')
}


async function runGitTimeTravel(
  root: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const action = String(input.action ?? '')
  const q = (s: unknown): string => String(s ?? '').replace(/"/g, '\\"')

  const check = await runCommand(root, 'git rev-parse --is-inside-work-tree')
  if (!/true/.test(check)) {
    return { text: 'Error: not a git repository (git_time_travel needs git history).' }
  }

  let cmd: string
  switch (action) {
    case 'log':
      cmd = input.path
        ? `git log --oneline -n 30 -- "${q(input.path)}"`
        : 'git log --oneline -n 30'
      break
    case 'search': {
      const term = q(input.query)
      if (!term) return { text: 'Error: "search" needs a query.' }
      cmd = `git log --oneline -n 30 -S"${term}" || git log --oneline -n 30 -G"${term}"`
      break
    }
    case 'show': {
      const ref = q(input.ref)
      if (!ref) return { text: 'Error: "show" needs a commit ref.' }
      cmd = `git show --stat --patch ${ref}`
      break
    }
    case 'blame': {
      const path = q(input.path)
      if (!path) return { text: 'Error: "blame" needs a path.' }
      cmd = `git blame -L 1,80 --date=short "${path}"`
      break
    }
    case 'diff': {
      const ref = q(input.ref)
      const ref2 = q(input.ref2) || 'HEAD'
      if (!ref) return { text: 'Error: "diff" needs a base ref.' }
      cmd = `git diff ${ref}..${ref2}`
      break
    }
    case 'bisect_log': {
      const good = q(input.good)
      const bad = q(input.bad) || 'HEAD'
      if (!good) return { text: 'Error: "bisect_log" needs a good ref.' }
      cmd = `git log --oneline ${good}..${bad}`
      break
    }
    default:
      return { text: `Error: unknown git_time_travel action "${action}".` }
  }

  const out = await runCommand(root, cmd)
  return { text: out.slice(0, 16_000) }
}



function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
=======
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
>>>>>>> baf0023 (release: CrabCode 0.2.8)
}

async function webSearch(query: string): Promise<string> {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
<<<<<<< HEAD
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
        }
      }
    )
    if (!res.ok) return `Search failed (HTTP ${res.status}).`
    const html = await res.text()

    const results: string[] = []
    const linkRe =
      /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    const snippetRe = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g

    const links: { url: string; title: string }[] = []
    let m: RegExpExecArray | null
    while ((m = linkRe.exec(html)) !== null && links.length < 8) {
      let url = m[1]
      const ud = url.match(/[?&]uddg=([^&]+)/)
      if (ud) url = decodeURIComponent(ud[1])
      links.push({ url, title: htmlToText(m[2]) })
    }
    const snippets: string[] = []
    while ((m = snippetRe.exec(html)) !== null && snippets.length < 8) {
      snippets.push(htmlToText(m[1]))
=======
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
>>>>>>> baf0023 (release: CrabCode 0.2.8)
    }

    for (let i = 0; i < links.length; i++) {
      results.push(
<<<<<<< HEAD
        `${i + 1}. ${links[i].title}\n   ${links[i].url}\n   ${snippets[i] ?? ''}`.trimEnd()
      )
    }
    return results.length ? results.join('\n\n') : 'No results.'
  } catch (err) {
    return `Search error: ${err instanceof Error ? err.message : String(err)}`
=======
        `${i + 1}. ${links[i].title}\n   ${links[i].url}\n   ${snippets[i] ?? ""}`.trimEnd(),
      );
    }
    return results.length ? results.join("\n\n") : "No results.";
  } catch (err) {
    return `Search error: ${err instanceof Error ? err.message : String(err)}`;
>>>>>>> baf0023 (release: CrabCode 0.2.8)
  }
}

async function fetchUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
<<<<<<< HEAD
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
      }
    })
    if (!res.ok) return `Fetch failed (HTTP ${res.status}).`
    const ct = res.headers.get('content-type') ?? ''
    const body = await res.text()
    const text = ct.includes('html') ? htmlToText(body) : body
    return text.slice(0, 12_000)
  } catch (err) {
    return `Fetch error: ${err instanceof Error ? err.message : String(err)}`
=======
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
>>>>>>> baf0023 (release: CrabCode 0.2.8)
  }
}

function openApp(name: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
<<<<<<< HEAD
    let cmd: string
    if (process.platform === 'win32') {
      cmd = `start "" "${name}"`
    } else if (process.platform === 'darwin') {
      cmd = `open -a "${name}"`
    } else {
      cmd = `${name} &`
    }
    exec(cmd, { windowsHide: true }, (err) => {
      if (err) reject(err)
      else resolvePromise()
    })
  })
=======
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
>>>>>>> baf0023 (release: CrabCode 0.2.8)
}

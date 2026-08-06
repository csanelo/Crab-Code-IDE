<div align="center">
  <a href="https://github.com/csanelo/Crab-Code-IDE">
    <img src="build/icon.png" width="104" height="104" alt="CrabCode" />
  </a>

  <h1>CrabCode</h1>

  <p><strong>A local-first desktop IDE with an integrated autonomous coding agent.</strong></p>
  <p>Editor, terminal, browser, project memory, reusable skills and model integrations in one focused workspace.</p>

  <p>
    <a href="https://t.me/Crab_Code"><strong>Telegram: @Crab_Code</strong></a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="https://t.me/csanelo"><strong>Developer: @csanelo</strong></a>
  </p>

  <p>
    <a href="https://github.com/csanelo/Crab-Code-IDE/actions/workflows/build-release.yml"><img src="https://img.shields.io/github/actions/workflow/status/csanelo/Crab-Code-IDE/build-release.yml?branch=main&style=flat-square&label=build&labelColor=111318&color=7c5cff" alt="Build status" /></a>
    <a href="https://github.com/csanelo/Crab-Code-IDE/releases"><img src="https://img.shields.io/github/v/release/csanelo/Crab-Code-IDE?style=flat-square&label=release&labelColor=111318&color=7c5cff" alt="Latest release" /></a>
    <a href="https://t.me/Crab_Code"><img src="https://img.shields.io/badge/Telegram-Crab__Code-111318?style=flat-square&logo=telegram&logoColor=ffffff" alt="CrabCode Telegram" /></a>
  </p>

  <p>
    <a href="#whats-new-in-032">What’s new</a>
    &nbsp;·&nbsp;
    <a href="#overview">Overview</a>
    &nbsp;·&nbsp;
    <a href="#capabilities">Capabilities</a>
    &nbsp;·&nbsp;
    <a href="#getting-started">Getting started</a>
    &nbsp;·&nbsp;
    <a href="#building">Building</a>
    &nbsp;·&nbsp;
    <a href="#architecture">Architecture</a>
  </p>
</div>

---

## What’s new in 0.3.2

This release focuses on long-session performance, transparent context usage, reliable cancellation and deeper terminal-aware agent execution.

### Long sessions stay responsive

- Optimized chat rendering and state updates for sessions containing tens of thousands of tokens.
- Reduced unnecessary work while the model is streaming or thinking.
- Settings, model controls and the project explorer remain responsive in large sessions.
- Fixed the project tree briefly disappearing and reappearing during agent activity.
- Reduced repeated file analysis by using persistent per-project working memory.

### Real context and token accounting

- The context menu shows the maximum context window of the currently selected model.
- Provider-reported model metadata is preferred when available, with a built-in model capability registry as a fallback.
- Tracks cumulative input, output, total and cached-input tokens across the complete agent/tool loop.
- Reads real usage metadata from OpenAI-compatible, Anthropic and Gemini responses.
- Clearly labels usage as **measured** when every step is provider-reported and **estimated** when a provider omits usage data.
- Includes support for explicit context suffixes such as `128k`, `256k` and `1m` in custom model identifiers.

### Stop now stops the complete run

- **Stop** cancels provider streaming immediately.
- Running web requests and abort-aware tools are cancelled.
- OAuth refresh and confirmation waits no longer keep a cancelled run alive.
- The renderer leaves the streaming state immediately, even if cancellation happens before the request map is populated.
- Late chunks, tool events and completion events from cancelled runs are ignored.

### Deeper terminal integration

- Pressing **Run** opens the integrated terminal when it is closed and inserts the exact command from the command card.
- The agent waits for the command to finish before continuing.
- Successful output produces a verdict; failed output is analyzed so the agent can propose a correction.
- Inline terminal output is colored, shows a compact initial viewport and remains scrollable.
- A running-state watchdog prevents commands from remaining stuck on `Running` forever.
- CrabCode respects the shell selected in Settings.
- Terminal execution memory remembers the working directory and avoids redundant `cd` commands.
- Command cards no longer append unrelated text to the command being executed.

### Better project memory and clearer agent activity

- Persistent file memory helps the agent remember already-read files across a task.
- Duplicate reads and repeated analysis of unchanged files are reduced.
- File-memory limits keep context bounded across projects and long sessions.
- Agent activity is shown as understandable actions—searching, reviewing, editing and validating—instead of raw internal tool names.
- Activity text follows the language used in the current dialogue.
- Whitespace-tolerant edit matching makes targeted code edits more resilient.

### Portable Skills

- Installed skills can include their complete bundle, not only `SKILL.md`.
- Scripts, templates and other required resources remain available when a new project is opened.
- Skills can be reused without reinstalling their supporting files for every project.

### Interface and workflow polish

- Redesigned mode, model and reasoning-effort selectors with a more compact visual hierarchy.
- Added an animated reasoning-effort indicator and clearer selected states.
- Simplified dropdown icons, descriptions and hover treatments.
- Refined action buttons, Steps indicators, attachment controls and invisible scrollbars.
- The default layout is **Files on the left, Chat on the right**.
- Settings include an option to swap the file and chat sides.
- Web access is enabled by default and can still be disabled per session.
- The context popover uses compact cards rather than the old technical footer.

### Provider cleanup

- Supports OpenAI-compatible APIs, Anthropic and Gemini.
- Includes the OpenCode Free connection path.
- Keeps MCP server integrations for external tools and services.
- Removed the non-working AgentRouter preset from the provider catalog.

---

## Overview

CrabCode is a cross-platform desktop development environment built for direct work with code and AI-assisted software development. It combines a Monaco editor, project explorer, integrated terminal, browser and project-aware agent runtime inside one Electron application.

CrabCode is local-first:

- Projects stay on your machine.
- Provider credentials are stored locally.
- The renderer has no direct Node.js access.
- Tools operate through a restricted preload bridge and the Electron main process.
- Agent access can be limited to the project, elevated intentionally or placed behind confirmation.

## Capabilities

### Development workspace

- Monaco editor with tabs, multi-file navigation and project search
- Integrated file explorer and terminal sessions
- Built-in browser for documentation and local interface review
- Language-server integration
- GitHub, SSH and remote-project workflows
- Adjustable Files/Chat panel layout
- Native desktop packaging for Windows, Linux and macOS

### Coding agent

- Reads, searches, creates and edits project files
- Uses project rules, local context and reusable Skills
- Remembers previously analyzed files and invalidates memory after mutations
- Runs a multi-step model/tool loop with visible, localized activity
- Uses the integrated terminal and follows command execution to completion
- Can inspect web content when the Web switch is enabled
- Can use desktop tools in High access when the task requires them
- Supports MCP servers for external tools and services

### Context transparency

The session context popover is based on the selected model rather than a fixed generic limit. It provides:

- Selected-model maximum context window
- Current prompt composition by category
- Cumulative input and output tokens for the run
- Cached-input token usage when reported by the provider
- Measured or estimated usage status

Usage is collected across intermediate agent steps, including calls made after tool results are returned to the model.

### Terminal-aware execution

Command cards are connected to the integrated terminal execution lifecycle:

1. The user reviews and presses **Run**.
2. CrabCode opens the terminal if necessary and inserts the exact command.
3. The agent waits while terminal output is collected.
4. On success, the agent continues with the verified result.
5. On failure, the agent analyzes the output and prepares a correction.

The configured shell and remembered working directory are used to avoid invalid syntax and unnecessary directory changes.

### Reusable Skills

A skill may contain instructions, scripts, templates and supporting assets. CrabCode preserves the complete skill bundle so it can be used in future projects instead of copying only the instruction file.

### Providers and connections

CrabCode supports:

- OpenAI-compatible APIs
- Anthropic
- Gemini
- OpenCode Free
- MCP servers
- GitHub
- SSH hosts

Model identifiers, base URLs and credentials are configured in **Settings → Providers**.

## Access modes

| Mode | Behaviour |
| --- | --- |
| `Normal` | Restricts file and project tools to the opened project. |
| `High` | Allows machine-level files, applications and desktop tools when needed. |
| `Ask` | Requests approval before mutating actions. |
| `Plan` | Keeps the session read-only and returns an implementation plan. |

Desktop control is currently implemented for Windows through native system APIs. Other platforms retain the editor, terminal, browser, SSH, MCP and project tools.

## Getting started

### Requirements

- Node.js 26.5.0
- npm 10 or newer
- Git

### Install

```bash
git clone https://github.com/csanelo/Crab-Code-IDE.git
cd Crab-Code-IDE
npm ci
```

### Run in development

```bash
npm run dev
```

### Validate

```bash
npm run typecheck
npm run build
```

## Building

Build a native package for a target platform:

```bash
npm run package:win
npm run package:linux
npm run package:mac
```

Compiled application files are written to `out/`. Installers and distributable packages are written to `dist/`.

| Platform | Output |
| --- | --- |
| Windows | NSIS installer, `.exe` |
| Linux | `.AppImage`, `.deb` |
| macOS | `.dmg`, `.zip` |

## CI/CD

The workflow at `.github/workflows/build-release.yml` installs exact dependencies with `npm ci`, runs TypeScript checks and packages CrabCode on Windows, Linux and macOS.

Every push to `main` or `master` starts a build. A version tag publishes generated artifacts as a GitHub Release.

```bash
git tag -a v0.3.2 -m "CrabCode 0.3.2"
git push origin v0.3.2
```

Unsigned builds use the repository-provided `GITHUB_TOKEN`; no additional GitHub secret is required for release publication.

## Architecture

```text
src/
├── main/       Electron main process, agent runtime and native services
├── preload/    Restricted IPC bridge
├── renderer/   React interface, editor, chat, browser and settings
└── shared/     Shared context, language and cross-process types

build/          Installer resources and application icons
resources/      Runtime resources
.github/        Build and release automation
```

The main process owns filesystem, terminal, browser, MCP, SSH and computer-control operations. The preload layer exposes a restricted IPC surface. The renderer contains no direct Node.js access.

## Technology

<p>
  <img src="https://img.shields.io/badge/Electron-33-111318?style=for-the-badge&logo=electron&logoColor=ffffff" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18-111318?style=for-the-badge&logo=react&logoColor=ffffff" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-111318?style=for-the-badge&logo=typescript&logoColor=ffffff" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5-111318?style=for-the-badge&logo=vite&logoColor=ffffff" alt="Vite" />
  <img src="https://img.shields.io/badge/Monaco-Editor-111318?style=for-the-badge&logo=visualstudiocode&logoColor=ffffff" alt="Monaco Editor" />
</p>

## Configuration

Open **Settings** and connect a provider using a base URL, model identifier and API key. Then choose the default shell, interface language, panel layout and other runtime preferences.

Web access is enabled by default for new sessions. Disable the Web switch whenever a task should remain fully offline.

## Security

- Keep API keys and access tokens outside the repository.
- Do not commit `.env` files.
- Review High access actions before enabling autonomous desktop or machine-level work.
- Use Ask mode when mutations should require confirmation.
- Publish signed installers when distributing production releases publicly.

## Project links

| Resource | Address |
| --- | --- |
| Telegram channel | [@Crab_Code](https://t.me/Crab_Code) |
| Developer | [@csanelo](https://t.me/csanelo) |
| Repository | [csanelo/Crab-Code-IDE](https://github.com/csanelo/Crab-Code-IDE) |
| Releases | [GitHub Releases](https://github.com/csanelo/Crab-Code-IDE/releases) |
| CI builds | [GitHub Actions](https://github.com/csanelo/Crab-Code-IDE/actions) |

## License

CrabCode is distributed under the MIT License.

---

<div align="center">
  <sub>CrabCode 0.3.2 · maintained by <a href="https://t.me/csanelo">@csanelo</a></sub>
</div>

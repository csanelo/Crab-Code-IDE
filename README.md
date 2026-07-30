<div align="center">
  <a href="https://github.com/csanelo/Crab-Code-IDE">
    <img src="build/icon.png" width="104" height="104" alt="CrabCode" />
  </a>

  <h1>CrabCode</h1>
  <p><strong>A cross-platform AI development environment for serious project work.</strong></p>
  <p>Code editor, terminal, browser, project tools, model providers, MCP and desktop automation in one application.</p>

  <p>
    <a href="https://t.me/Crab_Code"><strong>Telegram: @Crab_Code</strong></a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="https://t.me/csanelo"><strong>Developer: @csanelo</strong></a>
  </p>

  <p>
    <a href="https://github.com/csanelo/Crab-Code-IDE/releases"><img src="https://img.shields.io/github/v/release/csanelo/Crab-Code-IDE?style=flat-square&label=release&labelColor=111318&color=5c6370" alt="Latest release" /></a>
    <a href="https://github.com/csanelo/Crab-Code-IDE/actions"><img src="https://img.shields.io/github/actions/workflow/status/csanelo/Crab-Code-IDE/release.yml?style=flat-square&label=release%20build&labelColor=111318&color=5c6370" alt="Release build" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/github/license/csanelo/Crab-Code-IDE?style=flat-square&label=license&labelColor=111318&color=5c6370" alt="License" /></a>
    <a href="https://t.me/Crab_Code"><img src="https://img.shields.io/badge/Telegram-Crab__Code-111318?style=flat-square&logo=telegram&logoColor=ffffff" alt="Telegram" /></a>
  </p>

  <p>
    <a href="#overview">Overview</a>
    &nbsp;·&nbsp;
    <a href="#release-032">Release 0.3.2</a>
    &nbsp;·&nbsp;
    <a href="#core-capabilities">Capabilities</a>
    &nbsp;·&nbsp;
    <a href="#installation">Installation</a>
    &nbsp;·&nbsp;
    <a href="#release-history">Release history</a>
  </p>
</div>

---

## Overview

CrabCode is a desktop IDE built with Electron, React and TypeScript. It combines a Monaco-based editor, integrated terminal, file explorer, browser, AI agent and external tool connections inside a single workspace.

The project is designed around direct, controlled work. The agent can inspect a codebase, modify files, use terminals, connect to MCP servers, work with Skills, browse the web when enabled and interact with the desktop when High access is available. Sensitive operations remain governed by explicit access modes and approval controls.

CrabCode supports local projects, GitHub repositories and SSH workspaces. Provider credentials are stored locally and are not embedded into source code or release packages.

## Release 0.3.2

Version `0.3.2` focuses on agent quality, model access, MCP and Skills integration, desktop control, change review and long-running development workflows.

### Improved AI agent

The agent runtime has been refined for more reliable multi-step work across real projects.

- Better selection of tools for the current task.
- More consistent continuation across long conversations.
- Improved recovery after failed commands, tool calls and provider responses.
- More accurate handling of project context, previous edits and active files.
- Better separation between planning, approval and autonomous execution.
- Reduced unnecessary tool usage during ordinary questions or local code analysis.
- Clearer system instructions for coding, terminal work, web access and desktop control.

### Improved MCP integration

MCP connections are now treated as first-class tools inside the IDE.

- Dedicated MCP section in Settings.
- Connected servers are displayed in one place.
- Servers can be enabled or disabled without removing their configuration.
- Cleaner server presentation without unnecessary transport labels beside the name.
- Unified MCP iconography and a more compact settings layout.
- Improved MCP discovery and tool availability for the agent.
- Better support for local command-based servers and remote HTTP or SSE endpoints.

### Improved Skills workflow

Skills are easier to understand and use from the agent workflow.

- Simplified Skills interface.
- Removed the previous manual GitHub URL form from the main Skills screen.
- Added direct guidance to ask the agent to connect or install a Skill.
- Cleaner Skill names without repository path noise.
- Updated Skill icon and restrained visual presentation.
- Improved agent instructions for discovering and applying relevant Skills.

### Free AI models

CrabCode now includes access to free model options through the built-in provider catalog.

- Free models can be selected without manually creating every provider entry.
- Model availability is synchronized with the interface.
- Active model switching is faster and more predictable.
- Text-only and vision-capable model differences are handled more safely.
- Provider-specific payload compatibility has been improved, including text-only DeepSeek-style endpoints.

Free model availability can change according to provider limits, regional access and upstream service policies.

### Antigravity integration

The IDE can connect to and work through the Antigravity provider flow.

- Antigravity authentication and provider setup are integrated into CrabCode.
- Supported models are loaded and normalized for the model selector.
- Expired access tokens can be refreshed automatically when a refresh token is available.
- Model quota information can be requested from the provider.
- Agent conversations, tools and project work operate through the same IDE workflow as other providers.
- Provider failures and unavailable models are handled with safer fallback behavior.

### Reasoning effort controls

The model reasoning level can be selected according to the complexity of the task.

| Level | Intended use |
| --- | --- |
| `Low` | Small edits, quick explanations and lightweight tasks. |
| `Medium` | General development work and normal debugging. |
| `High` | Complex implementation, investigation and multi-file changes. |
| `XHigh` | Deep analysis, difficult debugging and larger architectural work. |
| `Max` | Long-running tasks that require the largest available reasoning budget and extended agent steps. |

The selected level affects the reasoning budget, maximum tool steps and supported provider parameters. Unsupported provider options are removed automatically when an endpoint rejects them.

### Improved Computer Access

Computer Access has been redesigned around the High access boundary.

- Desktop tools are available whenever High access is enabled.
- The user no longer needs to repeat a special permission phrase in every message.
- The agent decides whether a task actually requires the desktop.
- Ordinary chat, code reading and direct file edits remain tool-free when desktop interaction is unnecessary.
- The agent can list windows and processes, focus applications, capture the desktop, click, type, send keyboard shortcuts and scroll.
- Fresh screenshots are required before coordinate-based actions.
- Important actions can be verified with another capture afterward.
- Text-only models no longer receive unsupported `image_url` blocks.
- When possible, screenshots are converted into a textual visual description for models without vision support.

Desktop control is currently implemented for Windows. Editor, terminal, browser, MCP, SSH and project tools remain available on Linux and macOS.

### Improved Web access behavior

The Web switch is now the actual permission boundary for internet tools.

- When Web is enabled, the agent may search, fetch, browse and open online pages when the task requires it.
- A special phrase such as “search the web” is no longer required in every message.
- Repository pages, README files, documentation and relevant web resources can be opened directly.
- When Web is disabled, web tools and online URL operations remain blocked.
- Tool descriptions and system instructions now use the same Web access rules.

### Prompt and context improvements

Prompts and runtime instructions have been reorganized for more predictable behavior.

- Clearer separation between project rules, access rules, reasoning controls and tool instructions.
- Better handling of provider-specific prompt formats.
- Improved context compaction for long sessions.
- Older images and oversized tool results are omitted or summarized when necessary.
- Stable prompt prefixes improve provider-side caching.
- Agent instructions now prioritize direct project tools over unnecessary terminal or desktop actions.
- Recovery behavior is clearer when an edit, command or provider request fails.

### Inline file diffs

File changes can be reviewed directly inside the editor.

- Added lines are shown inline with the affected file.
- Previous content remains visible for comparison.
- Changes can be accepted or rejected without moving to a separate review screen.
- Pending edits remain associated with their files across navigation and application restarts.
- Confirmed changes are saved automatically.

### Safe Keep All

`Keep All` provides a controlled way to preserve the full set of pending changes.

- Keeps all currently reviewed edits instead of resolving each diff separately.
- Applies only to the visible pending change set.
- Preserves the original file state until the action is confirmed.
- Works with the existing unsaved-change protections.
- Reduces the risk of losing a multi-file agent result during review.

For sensitive repositories, Ask mode should still be used so each mutating operation requires approval before execution.

### Terminal observation

The agent can follow terminal output as part of an active development task.

- Terminal sessions remain connected to the project context.
- The model can inspect relevant command output and continue from build, test or runtime results.
- Long output is compacted to protect the model context window.
- Terminal state can be used to diagnose failed builds, missing dependencies and runtime errors.
- Commands are not executed silently when execution approval is required.

This behavior applies to active task sessions. CrabCode does not run a hidden background monitor outside the requested workflow.

## Core capabilities

### Development workspace

- Monaco editor with syntax highlighting and multi-file navigation.
- Project-aware file explorer and icons.
- Integrated local and SSH terminals.
- Built-in browser with page capture support.
- Language server integration.
- Local, GitHub and SSH project workflows.
- Light and dark interface themes.

### Agent modes

| Mode | Behavior |
| --- | --- |
| `Agent` | Applies approved project changes directly and verifies the result. |
| `Ask` | Requests confirmation before each mutating action. |
| `Plan` | Keeps the session read-only and produces an implementation plan. |

### Access levels

| Access | Behavior |
| --- | --- |
| `Normal` | Restricts filesystem and tools to the opened project. |
| `High` | Enables machine-level files, applications and desktop-control tools. |

### Providers and integrations

- OpenAI-compatible APIs.
- Anthropic.
- Gemini.
- Antigravity.
- Free model catalog.
- MCP servers.
- Skills.
- GitHub.
- SSH.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+K` | Open inline AI editing for the selected code. |
| `Ctrl+L` | Send the selected code range to chat with its file reference. |
| `Ctrl+Shift+P` | Open the Command Palette. |
| `Ctrl+Shift+Y` | Accept the current pending edit. |
| `Ctrl+N` | Reject or move away from the current pending edit, depending on editor context. |

Shortcuts may use `Cmd` instead of `Ctrl` on macOS.

## Installation

Download the latest package from [GitHub Releases](https://github.com/csanelo/Crab-Code-IDE/releases).

| Platform | Package |
| --- | --- |
| Windows x64 | NSIS `.exe` installer |
| Linux x64 | `.AppImage` or `.deb` |
| macOS Apple Silicon | ARM64 `.zip` or `.dmg`, depending on the release |

Builds are currently unsigned. Windows SmartScreen or macOS Gatekeeper may display a warning for downloaded packages.

## Build from source

### Requirements

- Node.js `26.5.0`
- npm
- Git

### Setup

```bash
git clone https://github.com/csanelo/Crab-Code-IDE.git
cd Crab-Code-IDE
npm ci
```

### Development

```bash
npm run dev
```

### Validation

```bash
npm run typecheck
npm run build
```

### Native packages

```bash
npm run package:win
npm run package:linux
npm run package:mac
```

Compiled application files are written to `out/`. Installers and distributable packages are written to `dist/`.

## Release workflow

Release packaging runs only when a version tag is pushed. Ordinary branch pushes, backup branches and pull requests do not create release builds.

The tag must match the version in `package.json`. For version `0.3.2`:

```bash
git tag -a v0.3.2 -m "CrabCode 0.3.2"
git push origin v0.3.2
```

The workflow validates the source, runs TypeScript checks, builds Windows, Linux and macOS packages, uploads the artifacts and publishes the matching GitHub Release.

## Architecture

```text
src/
├── main/       Electron main process, agent runtime and native services
├── preload/    Restricted IPC bridge
└── renderer/   React interface, editor, chat, browser and settings

build/          Installer resources and application icons
resources/      Runtime resources
.github/        Release automation
```

The main process owns filesystem, terminal, browser, MCP, SSH and computer-control operations. The preload layer exposes a restricted IPC surface. The renderer has no unrestricted direct Node.js access.

## Security model

- Provider tokens and API keys are stored locally.
- Operating-system encryption is used when available.
- `.env` files and generated build directories are excluded from source control.
- Normal access stays inside the active project.
- High access is required for machine-level and desktop operations.
- Ask mode requires approval before changes are applied.
- Plan mode removes mutating tools from the session.
- Unsaved file changes are protected by save, discard and cancel dialogs.

## Release history

### 0.3.2 — Agent, integrations and control

- Improved AI agent behavior and multi-step task execution.
- Improved MCP connection management and tool availability.
- Improved Skills installation and presentation.
- Added free AI model options.
- Added Antigravity connection and IDE workflow.
- Added `Low`, `Medium`, `High`, `XHigh` and `Max` reasoning levels.
- Improved Computer Access and text-only model compatibility.
- Improved Web permission handling.
- Improved prompts, context management and provider recovery.
- Added inline file diffs.
- Added safe `Keep All` for pending changes.
- Improved terminal output observation during active tasks.

### 0.3.0 — Computer Access and controlled editing

Version `0.3.0` moved the agent beyond chat and introduced controlled access to the development environment and operating system.

#### Computer Access

- Added command execution through the integrated terminal.
- Added project and machine-level file reading and writing.
- Added editing, archive creation, archive extraction, file upload and file download tools.
- Added confirmation requests for potentially dangerous actions.
- The agent displays the intended action and waits for Allow or Reject in approval mode.

#### Agent modes

- `Agent`: changes are applied automatically within the selected access boundary.
- `Ask`: every modification waits for confirmation.
- `Plan`: the agent investigates in read-only mode and returns a complete plan.

#### Inline editing

- Added `Ctrl+K` inline editing for selected code.
- Inline requests use the model selected in chat.
- Added `Ctrl+L` to send a file reference and exact line range to chat.

#### Change review

- New lines are highlighted in green.
- Previous content is displayed above the replacement.
- Changes can be accepted or rejected from the editor.
- Unresolved edits survive file navigation and application restarts.
- Accepted edits are saved automatically.

#### Data-loss protection

- Modified tabs display a dirty-state indicator.
- Closing a modified tab or exiting the application opens Save, Do Not Save and Cancel options.
- The application no longer closes silently with unsaved work.

#### Built-in browser

- Added a browser panel inside the IDE.
- Added rectangular region capture.
- Added full-page capture, including content outside the visible viewport.
- Captures can be sent directly to the agent conversation.

#### MCP servers

- Added a dedicated interface for external MCP server management.
- MCP tools are available to the agent alongside built-in tools.

#### Interface

- Added first-launch welcome experience.
- Added hover tooltips across the application.
- Replaced the loading spinner with a gradient response indicator.
- Added the ClopCode theme.
- Updated application and installer icons.

#### Fixes

- Fixed application startup failure caused by a localization file error.
- Fixed selection toolbar movement relative to the pointer.
- Fixed pending edits being lost when the editor closed.
- Removed the redundant confirmation panel above the chat input.

[View release 0.3.0](https://github.com/csanelo/Crab-Code-IDE/releases/tag/v0.3.0)

### 0.2.9 — Standalone Agent

Version `0.2.9` introduced a dedicated Agent workspace outside the main editor layout.

- Standalone Agent window focused on dialogue and task execution.
- Fast switching between the IDE and Agent workspace.
- Shared sessions and message history across modes.
- Session panel for managing active conversations.
- Integrated terminal below the Agent chat.
- Support for local and SSH terminals.
- Command Palette through `Ctrl+Shift+P`.
- Independent window scaling.
- Direct access to Settings from the Agent workspace.

[View release 0.2.9](https://github.com/csanelo/Crab-Code-IDE/releases/tag/v0.2.9)  
[Compare 0.2.8...0.2.9](https://github.com/csanelo/Crab-Code-IDE/compare/v0.2.8...v0.2.9)

### 0.2.8 — Global update

Version `0.2.8` improved agent performance, context management, change control and the overall interface.

#### Smart project index

- Added background indexing for files, functions, classes, types, symbols, imports and dependencies.
- Ranked codebase search results by relevance.
- Updated the index automatically after project changes.
- Reduced repeated file reads in large repositories.

#### Context optimization

- Added deep conversation history management.
- Compacted older messages and tool output automatically.
- Preserved recent and important context without modification.
- Removed outdated images and redundant data from the active context window.

#### Prompt caching

- Expanded caching for OpenAI, Anthropic and Gemini.
- Reused system instructions and repeated context.
- Added automatic cache refresh and recovery.
- Reduced token usage in long sessions and large projects.

#### Change control

- Enforced Ask before editing at the tool level.
- Required confirmation before writing, editing, creating, deleting, copying or moving files.
- Fully blocked writes in read-only mode.
- Preserved autonomous changes in Agent mode.

#### Models, web and files

- Added context usage indicator beside the active model.
- Added technical enforcement for the Web switch.
- Added chat file uploads up to 20 MB.
- Improved provider and model management.
- Synchronized model list changes with the interface.
- Preserved OpenAI, Anthropic, Gemini and compatible API support.

#### Interface and workspace

- Redesigned the editor, chat, terminal, Files, Changes, Workspace and Settings surfaces.
- Standardized spacing, rounding and component states.
- Removed unnecessary outlines and separators.
- Improved light and dark theme behavior.
- Added General Sans.
- Improved local, GitHub and SSH project workflows.
- Improved the workspace switcher.

#### Automatic updates

- Added GitHub Release checks every five minutes.
- Added automatic update download and installation.
- Restarted the application after an update completed.

[View release 0.2.8](https://github.com/csanelo/Crab-Code-IDE/releases/tag/v0.2.8)  
[View full changelog](https://github.com/csanelo/Crab-Code-IDE/commits/v0.2.8)

### 0.1.0 — Initial public release

The first public version established the core CrabCode workspace.

- Cross-platform Electron, React and TypeScript application.
- Monaco code editor with syntax highlighting.
- Integrated `node-pty` terminal.
- Project-aware file explorer.
- Built-in browser panel.
- AI chat and file-editing agent.
- OpenAI-compatible provider configuration.
- MCP tool integration.
- Light and dark themes.
- Multi-language interface.

[View release 0.1.0](https://github.com/csanelo/Crab-Code-IDE/releases/tag/v0.1.0)

## Project links

| Resource | Address |
| --- | --- |
| Telegram channel | [@Crab_Code](https://t.me/Crab_Code) |
| Developer | [@csanelo](https://t.me/csanelo) |
| Repository | [csanelo/Crab-Code-IDE](https://github.com/csanelo/Crab-Code-IDE) |
| Releases | [GitHub Releases](https://github.com/csanelo/Crab-Code-IDE/releases) |
| Build status | [GitHub Actions](https://github.com/csanelo/Crab-Code-IDE/actions) |

## License

CrabCode is distributed under the [MIT License](LICENSE).

---

<div align="center">
  <sub>CrabCode 0.3.2 · maintained by <a href="https://t.me/csanelo">@csanelo</a></sub>
</div>

# CrabCode
<p align="center">
  <video src="https://github.com/csanelo/Crab-Code-IDE/raw/main/media/crab.mp4" controls width="720"></video>
</p>

CrabCode is a cross-platform desktop AI development environment built with Electron, React and TypeScript that brings a code editor, an integrated terminal, a file explorer, a built-in web browser and an AI assistant together in one window, so you can open a project, edit files with a Monaco-powered editor, run commands, browse documentation and let an AI agent read, write and reason about your codebase through OpenAI-compatible providers and MCP tools without leaving the app.

## Requirements

- Node.js 18 or newer
- npm

## Run in development

```bash
npm install
npm run dev
```

## Build a production package

```bash
npm run build
npm run package:win    # Windows installer
npm run package:mac    # macOS dmg/zip
npm run package:linux  # Linux AppImage/deb
```

The build output is written to `out/`, and installers are written to `dist/`.

<<<<<<< HEAD
=======
## Prompt caching

The agent uses provider-side prompt caching to cut token costs on every request:

- **Anthropic** — the request marks three cache breakpoints with `cache_control: ephemeral`: the system prompt, the tool definitions, and the last message of the conversation. The large static prefix (system prompt + tools + prior history) is cached, so each following agent step and each following user message re-reads it from cache (cache reads cost ~10% of normal input tokens).
- **OpenAI and custom OpenAI-compatible providers** — caching is automatic for prompts over 1024 tokens; the request additionally sends a stable `prompt_cache_key` per project so consecutive requests land on the same cache and hit rates stay high. If a custom provider rejects the extra field, the request is retried once without it and the key is dropped for the rest of the session. The message prefix (system + history) is kept byte-stable between steps for maximum cache reuse.
- **Gemini** — the large system prompt is registered once per session as an explicit `cachedContents` entry with a 1-hour TTL and reused across requests via `cachedContent`; if explicit cache creation is not available (small prompt or unsupported endpoint), the request falls back to an inline system instruction, where implicit caching still applies automatically on 2.5-series models.

Nothing needs to be configured: caching activates by itself for every provider based on its API type.

>>>>>>> baf0023 (release: CrabCode 0.2.8)
## Configure the AI provider

Open Settings inside the app and add an OpenAI-compatible provider: set the base URL, model and API key. Keys are stored locally on your machine and are never bundled with the project.

## Project structure

```
src/
  main/      Electron main process: windowing, filesystem, terminal, agent, MCP, LSP
  preload/   Secure contextBridge IPC surface exposed to the renderer
  renderer/  React UI: editor, chat, files, terminal, browser, settings
```

<<<<<<< HEAD
=======
## UI design

The interface uses a modern flat style driven by tokens in `src/renderer/src/theme/tokens.css`:

- Blocks, cards, inputs and panels have no visible outlines — element borders are transparent and surfaces are separated by background depth and soft shadows. Hover and focus states may still tint the border for feedback.
- Corner rounding is increased across the app: `--radius-sm 10px`, `--radius-md 14px`, `--radius-lg 18px`, `--radius-xl 22px`, `--radius-2xl 28px`; small inline elements use 6–8px.
- The left and right panels remain unchanged and square.
- The four corners of the central code editor and of the settings content area are rounded with `--radius-sm`; their position, spacing and size are unchanged. The area behind them uses the same chrome background as the side panels, so the rounded corners are clearly visible.
- Thin separator lines remain removed from the title bar, status bar, panel headers and internal blocks. The only exception is a subtle divider between the navigation groups in the settings sidebar.
- When no folder is open, the Files panel shows a short notice at the top with a full-width Open Project button under it that opens the folder picker.
- Primary action buttons (send, connect, commit, save, conflict resolution, Open Project) use the dark overlay surface with regular text instead of white accent fills; toggles, sliders and the blinking cursor keep the accent color.
- The UI font is General Sans (loaded from Fontshare, with system font fallbacks when offline); code areas keep the mono font stack.
- Text renders crisp and clean: the engraved text-shadow effect is disabled, grayscale antialiasing is enabled and body text uses a subtle -0.01em letter-spacing.
- The access-level chip no longer turns yellow in High mode — it uses the same neutral colors as the other chips.
- The project switcher lives in the title bar next to the Help menu as a `workspace/<project>` breadcrumb (showing `workspace/No project` when nothing is open); clicking it opens the same folder/GitHub/SSH project menu that used to sit in the status bar.

To restyle the app, edit the token values — components inherit them everywhere.

>>>>>>> baf0023 (release: CrabCode 0.2.8)
## License

MIT

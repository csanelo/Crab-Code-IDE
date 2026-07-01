# CrabCode
F:\Проекты\clark\media\crab.mp4
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

## Configure the AI provider

Open Settings inside the app and add an OpenAI-compatible provider: set the base URL, model and API key. Keys are stored locally on your machine and are never bundled with the project.

## Project structure

```
src/
  main/      Electron main process: windowing, filesystem, terminal, agent, MCP, LSP
  preload/   Secure contextBridge IPC surface exposed to the renderer
  renderer/  React UI: editor, chat, files, terminal, browser, settings
```

## License

MIT

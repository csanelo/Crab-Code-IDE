import { contextBridge, ipcRenderer, webUtils } from 'electron'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const api = {
  window: {
    platform: process.platform as NodeJS.Platform,
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize') as Promise<boolean>,
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
    zoom: (delta: number) => ipcRenderer.invoke('window:zoom', delta) as Promise<number>,
    onMaximizedChange: (cb: (maximized: boolean) => void) => {
      const listener = (_e: unknown, value: boolean): void => cb(value)
      ipcRenderer.on('window:maximized', listener)
      return () => {
        ipcRenderer.removeListener('window:maximized', listener)
      }
    }
  },
  app: {
    about: () =>
      ipcRenderer.invoke('app:about') as Promise<{
        name: string
        version: string
        electron: string
        chromium: string
        node: string
        v8: string
        os: string
      }>,
    showAbout: () => ipcRenderer.invoke('app:show-about') as Promise<boolean>,
    copy: (text: string) => ipcRenderer.invoke('app:clipboard-write', text) as Promise<boolean>,
    paste: () => ipcRenderer.invoke('app:clipboard-read') as Promise<string>,
    onOpenPath: (cb: (payload: { path: string; isDir: boolean }) => void) => {
      const listener = (_e: unknown, payload: { path: string; isDir: boolean }): void =>
        cb(payload)
      ipcRenderer.on('app:open-path', listener)
      return () => {
        ipcRenderer.removeListener('app:open-path', listener)
      }
    }
  },
  project: {
    openDialog: () =>
      ipcRenderer.invoke('project:open-dialog') as Promise<{ path: string; name: string } | null>,
    reveal: (path: string) => ipcRenderer.invoke('project:reveal', path) as Promise<boolean>
  },
  fs: {
    openFolder: () =>
      ipcRenderer.invoke('fs:open-folder') as Promise<{ path: string; name: string } | null>,
    openFile: () =>
      ipcRenderer.invoke('fs:open-file') as Promise<{
        path: string
        name: string
        content: string
      } | null>,
    readDir: (dir: string) =>
      ipcRenderer.invoke('fs:read-dir', dir) as Promise<
        { name: string; path: string; isDir: boolean }[]
      >,
    readFile: (path: string, encoding?: string) =>
      ipcRenderer.invoke('fs:read-file', path, encoding) as Promise<{
        path: string
        name: string
        content: string
        encoding?: string
      } | null>,
    save: (payload: { path: string | null; content: string; encoding?: string }) =>
      ipcRenderer.invoke('fs:save', payload) as Promise<{ path: string; name: string } | null>,
    readBinary: (path: string) =>
      ipcRenderer.invoke('fs:read-binary', path) as Promise<{
        path: string
        name: string
        base64: string
        size: number
      } | null>,
    writeBinary: (payload: { path: string; base64: string }) =>
      ipcRenderer.invoke('fs:write-binary', payload) as Promise<
        { path: string; name: string } | { error: string }
      >,
    saveAs: (payload: { content: string; suggestedName?: string }) =>
      ipcRenderer.invoke('fs:save-as', payload) as Promise<{ path: string; name: string } | null>,
    rename: (payload: { path: string; newName: string }) =>
      ipcRenderer.invoke('fs:rename', payload) as Promise<
        { path: string; name: string } | { error: string }
      >,
    deletePath: (path: string) => ipcRenderer.invoke('fs:delete', path) as Promise<boolean>,
    createFile: (payload: { dir: string; name?: string }) =>
      ipcRenderer.invoke('fs:create-file', payload) as Promise<
        { path: string; name: string } | { error: string }
      >,
    createDir: (payload: { dir: string; name?: string }) =>
      ipcRenderer.invoke('fs:create-dir', payload) as Promise<
        { path: string; name: string } | { error: string }
      >,
    move: (payload: { source: string; destDir: string }) =>
      ipcRenderer.invoke('fs:move', payload) as Promise<
        { path: string; name: string } | { error: string }
      >,
    import: (payload: { sources: string[]; destDir: string }) =>
      ipcRenderer.invoke('fs:import', payload) as Promise<{
        imported: { path: string; name: string }[]
      }>,
    importData: (payload: {
      destDir: string
      files: { name: string; base64: string }[]
    }) =>
      ipcRenderer.invoke('fs:import-data', payload) as Promise<{
        imported: { path: string; name: string }[]
      }>,
    pathForFile: (file: File): string => webUtils.getPathForFile(file),
    showInFolder: (path: string) =>
      ipcRenderer.invoke('fs:show-in-folder', path) as Promise<boolean>,
    revert: (payload: { path: string; before: string; existed: boolean }) =>
      ipcRenderer.invoke('fs:revert', payload) as Promise<boolean>,
    search: (root: string, query: string, limit?: number) =>
      ipcRenderer.invoke('fs:search', { root, query, limit }) as Promise<
        { name: string; path: string; isDir: boolean }[]
      >,
    searchSymbols: (root: string, query: string, limit?: number) =>
      ipcRenderer.invoke('fs:search-symbols', { root, query, limit }) as Promise<
        { name: string; path: string; line: number; kind: string }[]
      >,
    searchContent: (payload: {
      root: string
      query: string
      regex?: boolean
      caseSensitive?: boolean
      wholeWord?: boolean
      include?: string
      exclude?: string
      maxResults?: number
    }) =>
      ipcRenderer.invoke('fs:search-content', payload) as Promise<{
        results: {
          path: string
          relPath: string
          matches: { line: number; column: number; length: number; preview: string }[]
        }[]
        truncated: boolean
        error?: string
      }>,
    replaceInFile: (payload: {
      path: string
      query: string
      replacement: string
      regex?: boolean
      caseSensitive?: boolean
      wholeWord?: boolean
    }) =>
      ipcRenderer.invoke('fs:replace-in-file', payload) as Promise<{
        ok: boolean
        changed?: number
        error?: string
      }>,
    newTerminal: (cwd: string | null) =>
      ipcRenderer.invoke('terminal:new', cwd) as Promise<boolean>
  },
  lsp: {
    open: (p: { root: string; languageId: string; uri: string; text: string }) =>
      ipcRenderer.invoke('lsp:open', p) as Promise<{ ok: boolean }>,
    change: (p: { root: string; languageId: string; uri: string; version: number; text: string }) =>
      ipcRenderer.invoke('lsp:change', p) as Promise<{ ok: boolean }>,
    close: (p: { root: string; languageId: string; uri: string }) =>
      ipcRenderer.invoke('lsp:close', p) as Promise<{ ok: boolean }>,
    completion: (p: {
      root: string
      languageId: string
      uri: string
      line: number
      character: number
    }) => ipcRenderer.invoke('lsp:completion', p) as Promise<unknown>,
    hover: (p: {
      root: string
      languageId: string
      uri: string
      line: number
      character: number
    }) => ipcRenderer.invoke('lsp:hover', p) as Promise<unknown>,
    definition: (p: {
      root: string
      languageId: string
      uri: string
      line: number
      character: number
    }) => ipcRenderer.invoke('lsp:definition', p) as Promise<unknown>,
    onDiagnostics: (cb: (payload: { uri: string; diagnostics: unknown[] }) => void) => {
      const listener = (_e: unknown, payload: { uri: string; diagnostics: unknown[] }): void =>
        cb(payload)
      ipcRenderer.on('lsp:diagnostics', listener)
      return () => {
        ipcRenderer.removeListener('lsp:diagnostics', listener)
      }
    }
  },
  browser: {
    onCommand: (
      cb: (payload: {
        kind: 'navigate' | 'capture'
        url?: string
        captureKind?: 'text' | 'screenshot'
        requestId?: string
      }) => void
    ) => {
      const listener = (_e: unknown, payload: never): void => cb(payload)
      ipcRenderer.on('browser:command', listener)
      return () => {
        ipcRenderer.removeListener('browser:command', listener)
      }
    },
    captureResult: (payload: {
      requestId: string
      ok: boolean
      data?: string
      url?: string
      title?: string
      error?: string
    }) => ipcRenderer.send('browser:capture-result', payload)
  },
  settings: {
    getGeneral: () =>
      ipcRenderer.invoke('settings:get-general') as Promise<{
        language: 'en' | 'zh' | 'hi' | 'es' | 'fr' | 'ar' | 'bn' | 'pt' | 'ru' | 'id'
        theme: 'dark' | 'light'
        themeId: string
        defaultShell: 'auto' | 'cmd' | 'powershell' | 'pwsh' | 'bash' | 'gitbash'
        enterToSend: boolean
        autosave: boolean
        restoreOnStart: boolean
        autoUpdate: boolean
        telemetry: boolean
        terminalAutoScroll: boolean
        richFileIcons: boolean
      }>,
    setGeneral: (partial: Record<string, unknown>) =>
      ipcRenderer.invoke('settings:set-general', partial) as Promise<unknown>
  },
  editor: {
    open: (path: string) => ipcRenderer.invoke('editor:open', path) as Promise<boolean>,
    openDiff: (payload: { path: string; original: string; modified: string }) =>
      ipcRenderer.invoke('editor:open-diff', payload) as Promise<boolean>,
    onOpenFile: (cb: (path: string) => void) => {
      const listener = (_e: unknown, path: string): void => cb(path)
      ipcRenderer.on('editor:open-file', listener)
      return () => {
        ipcRenderer.removeListener('editor:open-file', listener)
      }
    },
    onOpenDiff: (
      cb: (payload: { path: string; original: string; modified: string }) => void
    ) => {
      const listener = (
        _e: unknown,
        payload: { path: string; original: string; modified: string }
      ): void => cb(payload)
      ipcRenderer.on('editor:open-diff', listener)
      return () => {
        ipcRenderer.removeListener('editor:open-diff', listener)
      }
    },
    minimize: () => ipcRenderer.invoke('editor-window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('editor-window:toggle-maximize') as Promise<boolean>,
    close: () => ipcRenderer.invoke('editor-window:close')
  },
  terminal: {
    spawn: (id: string, cwd: string | null, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:spawn', { id, cwd, cols, rows }) as Promise<{
        pid: number
        reused: boolean
      }>,
    spawnRemote: (id: string, connId: string, cwd: string | null, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:spawn-remote', { id, connId, cwd, cols, rows }) as Promise<{
        pid: number
        reused: boolean
      }>,
    write: (id: string, data: string) =>
      ipcRenderer.invoke('terminal:write', id, data) as Promise<boolean>,
    interrupt: (id: string) => ipcRenderer.invoke('terminal:interrupt', id) as Promise<boolean>,
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', id, cols, rows) as Promise<boolean>,
    kill: (id: string) => ipcRenderer.invoke('terminal:kill', id) as Promise<boolean>,
    onData: (cb: (id: string, data: string) => void) => {
      const listener = (_e: unknown, id: string, data: string): void => cb(id, data)
      ipcRenderer.on('terminal:data', listener)
      return () => {
        ipcRenderer.removeListener('terminal:data', listener)
      }
    },
    onExit: (cb: (id: string, code: number) => void) => {
      const listener = (_e: unknown, id: string, code: number): void => cb(id, code)
      ipcRenderer.on('terminal:exit', listener)
      return () => {
        ipcRenderer.removeListener('terminal:exit', listener)
      }
    }
  },
  agent: {
    send: (
      requestId: string,
      messages: ChatMessage[],
      opts?: {
        cwd: string | null
        access?: 'normal' | 'high'
        editMode?: 'auto' | 'ask' | 'readonly'
      }
    ) => ipcRenderer.send('agent:send', requestId, messages, opts ?? { cwd: null }),
    abort: (requestId: string) => ipcRenderer.send('agent:abort', requestId),
    onChunk: (cb: (requestId: string, chunk: string) => void) => {
      const listener = (_e: unknown, id: string, chunk: string): void => cb(id, chunk)
      ipcRenderer.on('agent:chunk', listener)
      return () => {
        ipcRenderer.removeListener('agent:chunk', listener)
      }
    },
    onTool: (
      cb: (
        requestId: string,
        event: {
          name: string
          input: Record<string, unknown>
          status: 'running' | 'done'
          result?: string
          meta?: {
            path: string
            added: number
            removed: number
            diff: string
            before?: string
            existed?: boolean
          }
          command?: string
          mutated?: boolean
        }
      ) => void
    ) => {
      const listener = (
        _e: unknown,
        id: string,
        ev: {
          name: string
          input: Record<string, unknown>
          status: 'running' | 'done'
          result?: string
          meta?: {
            path: string
            added: number
            removed: number
            diff: string
            before?: string
            existed?: boolean
          }
          command?: string
          mutated?: boolean
        }
      ): void => cb(id, ev)
      ipcRenderer.on('agent:tool', listener)
      return () => {
        ipcRenderer.removeListener('agent:tool', listener)
      }
    },
    onDone: (cb: (requestId: string) => void) => {
      const listener = (_e: unknown, id: string): void => cb(id)
      ipcRenderer.on('agent:done', listener)
      return () => {
        ipcRenderer.removeListener('agent:done', listener)
      }
    },
    onError: (cb: (requestId: string, message: string) => void) => {
      const listener = (_e: unknown, id: string, message: string): void => cb(id, message)
      ipcRenderer.on('agent:error', listener)
      return () => {
        ipcRenderer.removeListener('agent:error', listener)
      }
    }
  },
  providers: {
    get: () =>
      ipcRenderer.invoke('providers:get') as Promise<{
        providers: Array<{
          id: string
          catalogId: string
          name: string
          api: 'openai' | 'anthropic' | 'gemini' | 'custom'
          baseUrl: string
          apiKeyEnc?: string
          models: { id: string; label: string }[]
        }>
        activeId: string | null
        activeModel: string | null
      }>,
    upsert: (config: {
      id: string
      catalogId: string
      name: string
      api: 'openai' | 'anthropic' | 'gemini' | 'custom'
      baseUrl: string
      models: { id: string; label: string }[]
      apiKey?: string
    }) => ipcRenderer.invoke('providers:upsert', config) as Promise<unknown>,
    remove: (id: string) => ipcRenderer.invoke('providers:remove', id) as Promise<unknown>,
    setActive: (payload: { id: string; model?: string }) =>
      ipcRenderer.invoke('providers:set-active', payload) as Promise<unknown>,
    test: (id: string) =>
      ipcRenderer.invoke('providers:test', id) as Promise<{
        ok: boolean
        status?: number
        error?: string
      }>
  },
  speech: {
    transcribe: (req: { audioBase64: string; mimeType: string; language?: string }) =>
      ipcRenderer.invoke('speech:transcribe', req) as Promise<{
        ok: boolean
        text?: string
        error?: string
      }>
  },
  skills: {
    list: (root: string) =>
      ipcRenderer.invoke('skills:list', root) as Promise<
        { name: string; description: string; path: string }[]
      >,
    add: (root: string, url: string) =>
      ipcRenderer.invoke('skills:add', { root, url }) as Promise<{
        ok: boolean
        name?: string
        description?: string
        error?: string
      }>,
    addFromRepo: (root: string, url: string, skill: string) =>
      ipcRenderer.invoke('skills:addFromRepo', { root, url, skill }) as Promise<{
        ok: boolean
        name?: string
        description?: string
        error?: string
      }>,
    listRepo: (url: string) =>
      ipcRenderer.invoke('skills:listRepo', url) as Promise<{
        ok: boolean
        skills?: string[]
        error?: string
      }>,
    create: (root: string, name: string, description: string, body: string) =>
      ipcRenderer.invoke('skills:create', { root, name, description, body }) as Promise<{
        ok: boolean
        name?: string
        description?: string
        error?: string
      }>,
    remove: (root: string, name: string) =>
      ipcRenderer.invoke('skills:remove', { root, name }) as Promise<boolean>,
    sync: (root: string) => ipcRenderer.invoke('skills:sync', root) as Promise<boolean>
  },
  github: {
    getAuth: () =>
      ipcRenderer.invoke('github:get-auth') as Promise<{
        connected: boolean
        login: string | null
        avatarUrl: string | null
      }>,
    connect: (pat: string) =>
      ipcRenderer.invoke('github:connect', pat) as Promise<{
        ok: boolean
        login?: string | null
        avatarUrl?: string | null
        error?: string
      }>,
    disconnect: () => ipcRenderer.invoke('github:disconnect') as Promise<{ ok: boolean }>,
    listRepos: () =>
      ipcRenderer.invoke('github:list-repos') as Promise<{
        ok: boolean
        error?: string
        repos: Array<{
          fullName: string
          name: string
          owner: string
          cloneUrl: string
          private: boolean
          description: string | null
          updatedAt: string
        }>
      }>,
    clone: (payload: { fullName: string; cloneUrl: string }) =>
      ipcRenderer.invoke('github:clone', payload) as Promise<
        { path: string; name: string } | { error: string }
      >,
    status: (path: string) =>
      ipcRenderer.invoke('github:status', path) as Promise<{
        isRepo: boolean
        branch?: string
        changed?: number
        ahead?: number
        behind?: number
        hasUpstream?: boolean
      }>,
    pull: (path: string) =>
      ipcRenderer.invoke('github:pull', path) as Promise<{ ok: boolean; error?: string }>,
    commitPush: (payload: { path: string; message: string; paths?: string[] }) =>
      ipcRenderer.invoke('github:commit-push', payload) as Promise<{
        ok: boolean
        error?: string
        committed?: boolean
      }>
  },
  ssh: {
    clone: (payload: { url: string }) =>
      ipcRenderer.invoke('ssh:clone', payload) as Promise<
        { path: string; name: string } | { error: string }
      >
  },
  remote: {
    list: () =>
      ipcRenderer.invoke('remote:list') as Promise<
        Array<{
          id: string
          label: string
          host: string
          port: number
          username: string
          authType: 'password' | 'key'
          keyPath?: string
          remoteRoot: string
          hasPassword: boolean
          hasPassphrase: boolean
        }>
      >,
    upsert: (cfg: {
      id?: string
      label: string
      host: string
      port: number
      username: string
      authType: 'password' | 'key'
      password?: string
      keyPath?: string
      passphrase?: string
      remoteRoot: string
    }) => ipcRenderer.invoke('remote:upsert', cfg) as Promise<{ id: string }>,
    remove: (id: string) => ipcRenderer.invoke('remote:remove', id) as Promise<boolean>,
    connect: (id: string) =>
      ipcRenderer.invoke('remote:connect', id) as Promise<
        { id: string; label: string; rootPath: string } | { error: string }
      >,
    disconnect: (id: string) => ipcRenderer.invoke('remote:disconnect', id) as Promise<boolean>,
    readDir: (path: string) =>
      ipcRenderer.invoke('remote:read-dir', path) as Promise<
        { name: string; path: string; isDir: boolean }[]
      >,
    readFile: (path: string) =>
      ipcRenderer.invoke('remote:read-file', path) as Promise<{
        path: string
        name: string
        content: string
      } | null>,
    writeFile: (payload: { path: string; content: string }) =>
      ipcRenderer.invoke('remote:write-file', payload) as Promise<
        { path: string } | { error: string }
      >,
    exec: (payload: { id: string; command: string; cwd?: string }) =>
      ipcRenderer.invoke('remote:exec', payload) as Promise<{
        code: number
        stdout: string
        stderr: string
      }>
  },
  mcp: {
    list: () =>
      ipcRenderer.invoke('mcp:list') as Promise<
        Array<{
          id: string
          name: string
          transport: 'stdio' | 'http' | 'sse'
          enabled: boolean
          command?: string
          args?: string[]
          env?: Record<string, string>
          url?: string
          headers?: Record<string, string>
        }>
      >,
    upsert: (server: {
      id?: string
      name: string
      transport: 'stdio' | 'http' | 'sse'
      enabled?: boolean
      command?: string
      args?: string[]
      env?: Record<string, string>
      url?: string
      headers?: Record<string, string>
    }) => ipcRenderer.invoke('mcp:upsert', server) as Promise<unknown>,
    remove: (id: string) => ipcRenderer.invoke('mcp:remove', id) as Promise<unknown>,
    setEnabled: (id: string, enabled: boolean) =>
      ipcRenderer.invoke('mcp:set-enabled', id, enabled) as Promise<unknown>
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api

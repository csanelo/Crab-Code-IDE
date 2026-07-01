class FileService {
  openFolder(): Promise<{ path: string; name: string } | null> {
    return window.api.fs.openFolder()
  }

  openFile(): Promise<{ path: string; name: string; content: string } | null> {
    return window.api.fs.openFile()
  }

  readDir(dir: string): Promise<{ name: string; path: string; isDir: boolean }[]> {
    return window.api.fs.readDir(dir)
  }

  readFile(path: string): Promise<{ path: string; name: string; content: string } | null> {
    return window.api.fs.readFile(path)
  }

  save(payload: { path: string | null; content: string }): Promise<{ path: string; name: string } | null> {
    return window.api.fs.save(payload)
  }

  saveAs(payload: { content: string; suggestedName?: string }): Promise<{ path: string; name: string } | null> {
    return window.api.fs.saveAs(payload)
  }

  newTerminal(cwd: string | null): Promise<boolean> {
    return window.api.fs.newTerminal(cwd)
  }
}

export const fileService = new FileService()

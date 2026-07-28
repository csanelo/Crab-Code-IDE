class ProjectService {
  async openDialog(): Promise<{ path: string; name: string } | null> {
    return window.api.project.openDialog()
  }

  async reveal(path: string): Promise<void> {
    await window.api.project.reveal(path)
  }
}

export const projectService = new ProjectService()

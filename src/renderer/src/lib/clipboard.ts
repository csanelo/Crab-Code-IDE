export function copyText(text: string): void {
  try {
    void window.api.app.copy(text)
  } catch {
    void navigator.clipboard?.writeText(text)
  }
}

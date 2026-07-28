
export function isSpeechSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  )
}

function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return ''
}

export class VoiceRecorder {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private mime = ''

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
    this.mime = pickMime()
    this.recorder = this.mime
      ? new MediaRecorder(this.stream, { mimeType: this.mime, audioBitsPerSecond: 128000 })
      : new MediaRecorder(this.stream)
    this.chunks = []
    this.recorder.ondataavailable = (e): void => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.recorder.start(250)
  }

  stop(): Promise<{ blob: Blob; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const rec = this.recorder
      if (!rec) {
        reject(new Error('not recording'))
        return
      }
      rec.onstop = (): void => {
        const type = this.mime || rec.mimeType || 'audio/webm'
        const blob = new Blob(this.chunks, { type })
        this.cleanup()
        resolve({ blob, mimeType: type })
      }
      try {
        rec.stop()
      } catch {
        this.cleanup()
        reject(new Error('stop failed'))
      }
    })
  }

  cancel(): void {
    try {
      this.recorder?.stop()
    } catch {
    }
    this.cleanup()
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.recorder = null
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = (): void => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = (): void => reject(new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

import { getActiveLang } from '../i18n'

export async function transcribe(
  blob: Blob,
  mimeType: string
): Promise<{ ok: boolean; text?: string; error?: string }> {
  const audioBase64 = await blobToBase64(blob)
  return window.api.speech.transcribe({ audioBase64, mimeType, language: getActiveLang() })
}

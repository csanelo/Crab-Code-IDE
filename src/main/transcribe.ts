import { ipcMain } from 'electron'
import { getProviderConfigs } from './providers'


interface TranscribeReq {
  audioBase64: string
  mimeType: string
  language?: string
}

function pickWhisperProvider(): { baseUrl: string; apiKey: string; models: string[] } | null {
  const configs = getProviderConfigs()
  const order = ['groq', 'openai']
  const ranked = [...configs].sort((a, b) => {
    const ai = order.indexOf(a.catalogId)
    const bi = order.indexOf(b.catalogId)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  for (const c of ranked) {
    if (!c.apiKey) continue
    if (c.api === 'openai' || c.api === 'custom') {
      const models =
        c.catalogId === 'groq'
          ? ['whisper-large-v3-turbo', 'whisper-large-v3']
          : c.catalogId === 'openai'
            ? ['gpt-4o-mini-transcribe', 'whisper-1']
            : [
                'whisper-1',
                'whisper-large-v3-turbo',
                'whisper-large-v3',
                'gpt-4o-mini-transcribe',
                'whisper'
              ]
      return { baseUrl: c.baseUrl, apiKey: c.apiKey, models }
    }
  }
  return null
}

async function discoverTranscribeModel(provider: {
  baseUrl: string
  apiKey: string
}): Promise<string | null> {
  try {
    const res = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/models`, {
      headers: { Authorization: `Bearer ${provider.apiKey}` }
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: Array<{ id?: string }> } | Array<{ id?: string }>
    const list = Array.isArray(json) ? json : (json.data ?? [])
    const ids = list.map((m) => String(m?.id ?? '')).filter(Boolean)
    const match =
      ids.find((id) => /whisper/i.test(id)) ??
      ids.find((id) => /transcrib/i.test(id)) ??
      ids.find((id) => /(stt|speech|asr|voxtral)/i.test(id))
    return match ?? null
  } catch {
    return null
  }
}

async function transcribeWith(
  provider: { baseUrl: string; apiKey: string },
  model: string,
  bytes: Buffer,
  mimeType: string,
  ext: string,
  language?: string
): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: mimeType }), `audio.${ext}`)
  form.append('model', model)
  const lang = (language ?? '').slice(0, 2).toLowerCase()
  if (lang && lang !== 'auto') form.append('language', lang)
  form.append('temperature', '0')
  form.append('response_format', 'json')

  const url = `${provider.baseUrl.replace(/\/$/, '')}/audio/transcriptions`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${provider.apiKey}` },
    body: form
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return { ok: false, status: res.status, error: `HTTP ${res.status}: ${text.slice(0, 300)}` }
  }
  const json = (await res.json()) as { text?: string }
  return { ok: true, text: (json.text ?? '').trim() }
}

export function registerTranscribe(ipcMain_: typeof ipcMain): void {
  ipcMain_.handle('speech:transcribe', async (_e, req: TranscribeReq) => {
    const provider = pickWhisperProvider()
    if (!provider) {
      return {
        ok: false,
        error:
          'Нет провайдера с поддержкой распознавания речи. Подключите OpenAI или Groq в Settings → Providers.'
      }
    }
    try {
      const bytes = Buffer.from(req.audioBase64, 'base64')
      const ext = req.mimeType.includes('webm')
        ? 'webm'
        : req.mimeType.includes('ogg')
          ? 'ogg'
          : req.mimeType.includes('mp4')
            ? 'mp4'
            : 'wav'

      let lastError = 'Распознавание не удалось'
      let modelIssue = false
      for (const model of provider.models) {
        const r = await transcribeWith(provider, model, bytes, req.mimeType, ext, req.language)
        if (r.ok) return { ok: true, text: r.text }
        lastError = r.error
        const isModelIssue =
          r.status === 400 || r.status === 404 || /unknown[_ ]model|does not exist|not found/i.test(r.error)
        if (!isModelIssue) {
          modelIssue = false
          break
        }
        modelIssue = true
      }

      if (modelIssue) {
        const discovered = await discoverTranscribeModel(provider)
        if (discovered) {
          const r = await transcribeWith(provider, discovered, bytes, req.mimeType, ext, req.language)
          if (r.ok) return { ok: true, text: r.text }
          lastError = r.error
        } else {
          return {
            ok: false,
            error:
              'У выбранного провайдера нет модели распознавания речи (Whisper). ' +
              'Подключите OpenAI или Groq в Settings → Providers и выберите его активным.'
          }
        }
      }
      return { ok: false, error: lastError }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

import { getActiveProvider, getProviderConfigs } from './providers'


const VISION_PROMPT =
  'You are the eyes of a coding agent. Describe this screenshot of a web page precisely and ' +
  'objectively for an engineer who cannot see it. Cover: overall layout and structure, visible ' +
  'text/content, colors and typography, spacing/alignment, and ANY visual problems — overlapping ' +
  'or cut-off elements, broken layout, low contrast, misalignment, error messages. Be concrete. ' +
  'If everything looks correct, say so.'

function isVisionModel(api: string, model: string): boolean {
  const m = model.toLowerCase()
  if (api === 'gemini') return /gemini/.test(m)
  if (api === 'anthropic') return /claude-3|claude-3\.5|claude-3-5|claude-4|sonnet|opus|haiku/.test(m)
  return /gpt-4o|gpt-4\.1|gpt-4-turbo|o4|omni|vision|llava|qwen.*v|moondream|minicpm-v|pixtral|llama-?3\.2.*vision/.test(
    m
  )
}

interface VisionTarget {
  api: string
  baseUrl: string
  apiKey: string
  model: string
}

function pickVisionTarget(): VisionTarget | null {
  const active = getActiveProvider()
  if (active && active.apiKey && isVisionModel(active.config.api, active.model)) {
    return {
      api: active.config.api,
      baseUrl: active.config.baseUrl,
      apiKey: active.apiKey,
      model: active.model
    }
  }
  for (const c of getProviderConfigs()) {
    if (!c.apiKey) continue
    const guess =
      c.api === 'gemini'
        ? 'gemini-1.5-flash'
        : c.api === 'anthropic'
          ? 'claude-3-5-sonnet-latest'
          : 'gpt-4o-mini'
    if (isVisionModel(c.api, guess)) {
      return { api: c.api, baseUrl: c.baseUrl, apiKey: c.apiKey, model: guess }
    }
  }
  return null
}

export async function describeImage(dataUrl: string): Promise<string | null> {
  const target = pickVisionTarget()
  if (!target) return null
  try {
    if (target.api === 'anthropic') {
      const res = await fetch(`${target.baseUrl.replace(/\/$/, '')}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': target.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: target.model,
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: VISION_PROMPT },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: dataUrl.replace(/^data:[^,]+,/, '')
                  }
                }
              ]
            }
          ]
        })
      })
      if (!res.ok) return null
      const json = (await res.json()) as { content?: Array<{ text?: string }> }
      return json.content?.map((b) => b.text ?? '').join('').trim() || null
    }

    if (target.api === 'gemini') {
      const url =
        `${target.baseUrl.replace(/\/$/, '')}/v1beta/models/${target.model}:generateContent` +
        `?key=${encodeURIComponent(target.apiKey)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: VISION_PROMPT },
                { inlineData: { mimeType: 'image/png', data: dataUrl.replace(/^data:[^,]+,/, '') } }
              ]
            }
          ]
        })
      })
      if (!res.ok) return null
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() || null
    }

    const res = await fetch(`${target.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${target.apiKey}`
      },
      body: JSON.stringify({
        model: target.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VISION_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ]
      })
    })
    if (!res.ok) return null
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return json.choices?.[0]?.message?.content?.trim() || null
  } catch {
    return null
  }
}

export function activeModelHasVision(): boolean {
  const active = getActiveProvider()
  return Boolean(active && isVisionModel(active.config.api, active.model))
}

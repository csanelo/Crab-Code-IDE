import type { ChatMessage, ToolCall } from '../domain/types'

interface WireMessage {
  role: 'user' | 'assistant'
  content: string
  images?: { mimeType: string; dataUrl: string }[]
}

export interface StreamHandlers {
  onChunk: (text: string) => void
  onTool: (tool: ToolCall) => void
  onDone: () => void
  onError: (message: string) => void
}

class AgentService {
  send(
    requestId: string,
    history: ChatMessage[],
    cwd: string | null,
    access: 'normal' | 'high',
    editMode: 'auto' | 'ask' | 'readonly',
<<<<<<< HEAD
    handlers: StreamHandlers
  ): () => void {
    const wire: WireMessage[] = history.map((m) => ({
      role: m.role,
      content: m.content,
      images: m.attachments?.map((a) => ({ mimeType: a.mimeType, dataUrl: a.dataUrl }))
    }))
=======
    webEnabled: boolean,
    handlers: StreamHandlers
  ): () => void {
    const wire: WireMessage[] = history.map((message) => {
      const images = message.attachments
        ?.filter((attachment) => attachment.mimeType.startsWith('image/'))
        .map((attachment) => ({
          mimeType: attachment.mimeType,
          dataUrl: attachment.dataUrl
        }))
      return {
        role: message.role,
        content: message.content,
        images: images && images.length > 0 ? images : undefined
      }
    })
>>>>>>> baf0023 (release: CrabCode 0.2.8)

    const offChunk = window.api.agent.onChunk((id, chunk) => {
      if (id === requestId) handlers.onChunk(chunk)
    })
    const offTool = window.api.agent.onTool((id, ev) => {
      if (id === requestId) handlers.onTool(ev as ToolCall)
    })
    const offDone = window.api.agent.onDone((id) => {
      if (id === requestId) handlers.onDone()
    })
    const offError = window.api.agent.onError((id, message) => {
      if (id === requestId) handlers.onError(message)
    })

<<<<<<< HEAD
    window.api.agent.send(requestId, wire, { cwd, access, editMode })
=======
    window.api.agent.send(requestId, wire, { cwd, access, editMode, webEnabled })
>>>>>>> baf0023 (release: CrabCode 0.2.8)

    return () => {
      offChunk()
      offTool()
      offDone()
      offError()
    }
  }
}

export const agentService = new AgentService()

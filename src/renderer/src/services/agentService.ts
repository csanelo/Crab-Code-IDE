import type { ChatMessage, ToolCall } from "../domain/types";

interface WireMessage {
  role: "user" | "assistant";
  content: string;
  images?: { mimeType: string; dataUrl: string }[];
}

export interface StreamHandlers {
  onChunk: (text: string) => void;
  onTool: (tool: ToolCall) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

class AgentService {
  send(
    requestId: string,
    history: ChatMessage[],
    cwd: string | null,
    access: "normal" | "high",
    editMode: "auto" | "ask" | "readonly",
    webEnabled: boolean,
    handlers: StreamHandlers,
  ): () => void {
    let buffer = "";
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = (): void => {
      if (!buffer) return;
      const out = buffer;
      buffer = "";
      handlers.onChunk(out);
    };

    const wire: WireMessage[] = history.map((message) => {
      const images = message.attachments
        ?.filter((attachment) => attachment.mimeType.startsWith("image/"))
        .map((attachment) => ({
          mimeType: attachment.mimeType,
          dataUrl: attachment.dataUrl,
        }));
      return {
        role: message.role,
        content: message.content,
        images: images && images.length > 0 ? images : undefined,
      };
    });

    const offChunk = window.api.agent.onChunk((id, chunk) => {
      if (id !== requestId) return;
      buffer += chunk;
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
      }, 40);
    });
    const offTool = window.api.agent.onTool((id, ev) => {
      if (id === requestId) handlers.onTool(ev as ToolCall);
    });
    const offDone = window.api.agent.onDone((id) => {
      if (id !== requestId) return;
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flush();
      handlers.onDone();
    });
    const offError = window.api.agent.onError((id, message) => {
      if (id !== requestId) return;
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flush();
      handlers.onError(message);
    });

    window.api.agent.send(requestId, wire, {
      cwd,
      access,
      editMode,
      webEnabled,
    });

    return () => {
      offChunk();
      offTool();
      offDone();
      offError();
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    };
  }
}

export const agentService = new AgentService();

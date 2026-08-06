import type { ChatMessage, ToolCall } from "../domain/types";
import type { ContextUsageSnapshot } from "../../../shared/contextUsage";
import { getReasoningEffort } from "../lib/reasoningEffort";

interface WireMessage {
  role: "user" | "assistant";
  content: string;
  images?: { mimeType: string; dataUrl: string }[];
  reasoning_content?: string;
  reasoningContent?: string;
}

export interface StreamHandlers {
  onChunk: (text: string) => void;
  onContextUsage: (usage: ContextUsageSnapshot) => void;
  onAborted: () => void;
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
      const reasoning = message.reasoning_content ?? message.reasoningContent;
      return {
        role: message.role,
        content: message.content,
        images: images && images.length > 0 ? images : undefined,
        ...(reasoning ? { reasoning_content: reasoning } : {}),
      };
    });

    const offChunk = window.api.agent.onChunk((id, chunk) => {
      if (id !== requestId) return;
      buffer += chunk;
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
      // Batch streaming updates so rendering stays responsive while another chat is busy.
      }, 120);
    });
    const offContextUsage = window.api.agent.onContextUsage((id, usage) => {
      if (id === requestId) handlers.onContextUsage(usage);
    });
    const offAborted = window.api.agent.onAborted((id) => {
      if (id !== requestId) return;
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      buffer = "";
      handlers.onAborted();
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
      reasoningEffort: getReasoningEffort(),
    });

    return () => {
      offChunk();
      offContextUsage();
      offAborted();
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

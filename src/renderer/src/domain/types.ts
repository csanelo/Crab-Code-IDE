export type ID = string;

export type MessageRole = "user" | "assistant";

export interface Attachment {
  id: ID;
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface ToolDiffMeta {
  path: string;
  added: number;
  removed: number;
  diff: string;
  before?: string;
  existed?: boolean;
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  status: "running" | "done";
  result?: string;
  meta?: ToolDiffMeta;
  command?: string;
  mutated?: boolean;
}

export interface FileChange {
  path: string;
  added: number;
  removed: number;
  diff: string;
  updatedAt: number;
  before: string;
  existed: boolean;
}

export type MessageSegment =
  { kind: "text"; text: string } | { kind: "tool"; tool: ToolCall };

export interface ChatMessage {
  id: ID;
  role: MessageRole;
  content: string;
  createdAt: number;
  attachments?: Attachment[];
  streaming?: boolean;
  error?: string;
  durationMs?: number;
  tokens?: number;
  toolCalls?: ToolCall[];
  segments?: MessageSegment[];
}

export interface Conversation {
  id: ID;
  title: string;
  repositoryId: ID | null;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

export interface Repository {
  id: ID;
  name: string;
  path: string | null;
  conversationIds: ID[];
  pinned?: boolean;
  source?: "folder" | "github" | "ssh";
}

export interface AgentSettings {
  baseUrl: string;
  model: string;
  hasKey: boolean;
}

export interface AgentSessionSnapshot {
  conversations: Record<ID, Conversation>;
  repositoryConversationIds: Record<ID, ID[]>;
  activeConversationId: ID | null;
}

export type View = "chat" | "settings";

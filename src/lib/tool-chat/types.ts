export type ToolId =
  | "role-builder"
  | "organization-profile"
  | "process-builder";

export type ToolChatMode = "chat" | "extract" | "both";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
};

export type ToolChatRequest<TContext = unknown> = {
  toolId: ToolId;
  mode: ToolChatMode;
  conversation: Array<Pick<ChatMessage, "role" | "content">>;
  context: TContext;
};

export type ToolChatResponse<TAction = unknown> = {
  assistantMessage?: string;
  action?: TAction;
  warnings?: string[];
  error?: string;
};

export type ToolChatUiConfig = {
  toolId: ToolId;
  title: string;
  description?: string;
  placeholder?: string;
  /**
   * Sample prompts to show when chat is empty.
   */
  samplePrompts?: string[];
  /**
   * When false, ToolChat will not call network and will show a stub response.
   * Use this until the backend endpoints accept the ToolChat envelope.
   */
  enabled: boolean;
  /**
   * API endpoint expected to accept ToolChatRequest and return ToolChatResponse.
   * (May be unused until enabled=true.)
   */
  endpoint: string;
};


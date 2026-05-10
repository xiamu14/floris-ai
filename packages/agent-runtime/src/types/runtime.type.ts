import type { AgentProfile } from "./agent.type";
import type { ContextBuilder } from "./context.type";
import type { ModelProvider } from "./provider.type";
import type { SessionStore } from "./session.type";
import type { ToolRegistry } from "./tool.type";

export type LoopStopReason =
  | "assistant_done"
  | "tool_use"
  | "max_iterations"
  | "provider_error"
  | "user_interrupted"
  | "tool_error";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AgentRunOptions {
  maxIterations?: number;
}

export interface RunTurnInput {
  profile: AgentProfile;
  threadId: string;
  branchId: string;
  userMessage: string;
  signal?: AbortSignal;
  options?: AgentRunOptions;
}

export interface RunTurnResult {
  threadId: string;
  branchId: string;
  stopReason: LoopStopReason;
  events: AgentEvent[];
  usage: TokenUsage;
  finalMessage?: string;
}

export interface AgentLoopDeps {
  provider: ModelProvider;
  toolRegistry: ToolRegistry;
  hookRunner?: unknown;
  contextBuilder: ContextBuilder;
  sessionStore?: SessionStore;
  permissionGate?: unknown;
}

export interface LoopState {
  threadId: string;
  branchId: string;
  iteration: number;
  messages: AgentMessage[];
  pendingToolCalls: RuntimeToolCall[];
  events: AgentEvent[];
  usage: TokenUsage;
  stopReason?: LoopStopReason;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
}

export interface RuntimeToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface AgentEvent {
  id: string;
  type: string;
  threadId: string;
  branchId: string;
  parentId?: string;
  createdAt: string;
  payload?: unknown;
}

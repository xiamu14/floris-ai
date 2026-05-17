import type { LoopStopReason, TokenUsage } from "./runtime.type";

export type AgentStreamEventType =
  | "run.started"
  | "message.delta"
  | "message.completed"
  | "tool.started"
  | "tool.completed"
  | "context.built"
  | "run.graph.updated"
  | "run.completed"
  | "run.failed";

export interface AgentStreamEvent {
  id: string;
  type: AgentStreamEventType;
  runId: string;
  threadId: string;
  branchId: string;
  createdAt: string;
  payload?: AgentStreamEventPayload;
}

export type AgentStreamEventPayload =
  | RunStartedPayload
  | MessageDeltaPayload
  | MessageCompletedPayload
  | ToolStartedPayload
  | ToolCompletedPayload
  | ContextBuiltPayload
  | RunGraphUpdatedPayload
  | RunCompletedPayload
  | RunFailedPayload
  | Record<string, unknown>;

export interface RunStartedPayload {
  message: string;
}

export interface MessageDeltaPayload {
  text: string;
}

export interface MessageCompletedPayload {
  message: string;
}

export interface ToolStartedPayload {
  toolCallId: string;
  toolName: string;
  input?: unknown;
}

export interface ToolCompletedPayload {
  toolCallId: string;
  ok: boolean;
  summary?: string;
  error?: unknown;
}

export interface ContextBuiltPayload {
  tokenEstimate?: number;
  sections?: unknown[];
  skippedSections?: unknown[];
}

export interface RunGraphUpdatedPayload {
  graph: unknown;
}

export interface RunCompletedPayload {
  stopReason: LoopStopReason;
  usage: TokenUsage;
}

export interface RunFailedPayload {
  code: string;
  message: string;
}

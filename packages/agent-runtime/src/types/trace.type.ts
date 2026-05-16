import type { AgentProfile, ModelRef } from "./agent.type";
import type { ModelStopReason, ModelToolCall } from "./provider.type";
import type { LoopStopReason, TokenUsage } from "./runtime.type";
import type { ToolResult } from "./tool-output.type";

export type TraceSpanKind = "agent" | "context" | "model" | "tool" | "filter";

export type TraceSpanStatus = "ok" | "error";

export interface TraceRecorder {
  startRun(input: TraceRunStartInput): TraceRunHandle;
  flush(): Promise<void>;
}

export interface TraceRunStartInput {
  runId: string;
  threadId: string;
  branchId: string;
  workspacePath: string;
  profile: AgentProfile;
  userMessage: string;
}

export interface TraceRunHandle {
  startSpan(input: TraceSpanStartInput): TraceSpanHandle;
  recordProviderEvent(input: TraceProviderEventInput): void;
  finish(input: TraceRunFinishInput): void;
}

export interface TraceSpanStartInput {
  id: string;
  parentId?: string;
  name: string;
  kind: TraceSpanKind;
  attributes?: Record<string, string | number | boolean>;
  inputs?: unknown;
}

export interface TraceSpanHandle {
  id: string;
  finish(input?: TraceSpanFinishInput): void;
}

export interface TraceSpanFinishInput {
  status?: TraceSpanStatus;
  outputs?: unknown;
  attributes?: Record<string, string | number | boolean>;
}

export interface TraceProviderEventInput {
  spanId: string;
  iteration: number;
  eventType: string;
  usage?: TokenUsage;
}

export interface TraceRunMetrics {
  contextBuildCount: number;
  modelRequestCount: number;
  toolCallCount: number;
}

export interface TraceRunFinishInput {
  stopReason: LoopStopReason;
  finalMessage: string;
  usage: TokenUsage;
  metrics: TraceRunMetrics;
}

export interface TraceModelRequestInput {
  iteration: number;
  model: ModelRef;
  toolCount: number;
  messageCount: number;
}

export interface TraceProviderResultInput {
  stopReason: ModelStopReason;
  textLength: number;
  toolCallCount: number;
  usage: TokenUsage;
}

export interface TraceToolCallInput {
  iteration: number;
  toolCall: ModelToolCall;
}

export interface TraceToolResultInput {
  toolCallId: string;
  result: ToolResult;
}

export interface MlflowTraceRecorderOptions {
  trackingUri: string;
  experimentId: string;
  sourceName?: string;
}

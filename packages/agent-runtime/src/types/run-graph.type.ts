import type { AgentEvent, LoopStopReason, TokenUsage } from "./runtime.type";

export interface BuildRunGraphInput {
  events: AgentEvent[];
  runId?: string;
}

export interface RunGraph {
  schemaVersion: 1;
  runId: string;
  threadId: string;
  branchId: string;
  startedAt: string;
  endedAt?: string;
  stopReason?: LoopStopReason;
  nodes: RunGraphNode[];
  edges: RunGraphEdge[];
  metrics: RunGraphMetrics;
  diagnostics: RunGraphDiagnostic[];
}

export interface RunGraphNode {
  id: string;
  kind: RunGraphNodeKind;
  label: string;
  status: RunGraphNodeStatus;
  timestamp: string;
  eventId: string;
  iteration?: number;
  traceSpanId?: string;
  payloadSummary?: unknown;
  metrics?: RunGraphNodeMetrics;
}

export type RunGraphNodeKind =
  | "user_message"
  | "context_build"
  | "model_request"
  | "provider_event"
  | "permission"
  | "tool_call"
  | "tool_result"
  | "final_synthesis"
  | "stop";

export type RunGraphNodeStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "skipped";

export interface RunGraphNodeMetrics {
  tokenEstimate?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
}

export interface RunGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: RunGraphEdgeKind;
  label?: string;
}

export type RunGraphEdgeKind = "transition" | "contains" | "caused_by";

export interface RunGraphMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  modelRequestCount: number;
  toolCallCount: number;
  contextBuildCount: number;
}

export interface RunGraphDiagnostic {
  id: string;
  code: RunGraphDiagnosticCode;
  severity: RunGraphDiagnosticSeverity;
  message: string;
  nodeId?: string;
}

export type RunGraphDiagnosticCode =
  | "invalid_transition"
  | "missing_stop"
  | "tool_without_permission"
  | "permission_denied_but_tool_executed"
  | "repeated_tool_call"
  | "provider_max_tokens_without_explicit_stop"
  | "context_budget_high"
  | "unlinked_event";

export type RunGraphDiagnosticSeverity = "info" | "warning" | "error";

export interface RunGraphEventShape {
  iteration?: number;
  event?: unknown;
  toolCall?: unknown;
  toolCallId?: string;
  decision?: unknown;
  result?: unknown;
  stopReason?: LoopStopReason;
  tokenEstimate?: number;
}

export interface RunGraphModelEventShape {
  type?: string;
  stopReason?: string;
  usage?: TokenUsage;
  toolCall?: {
    id?: string;
    name?: string;
    input?: unknown;
  };
}

export interface RunGraphPermissionDecisionShape {
  decision?: string;
  reason?: string;
  toolName?: string;
}

export interface RunGraphToolResultShape {
  ok?: boolean;
  summary?: string;
  error?: {
    code?: string;
    message?: string;
    recoverable?: boolean;
  };
  metrics?: {
    estimatedContextTokens?: number;
    estimatedRawTokens?: number;
    truncated?: boolean;
  };
}

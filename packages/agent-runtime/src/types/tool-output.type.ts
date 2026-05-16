export type ToolOutputOptimizationStrategy =
  | "stats_extraction"
  | "failure_focus"
  | "error_only"
  | "group_by_pattern"
  | "deduplicate"
  | "json_shape"
  | "structure_only"
  | "progress_filter"
  | "tail_head"
  | "raw_ref_only";

export type ToolContextPolicy =
  | "include"
  | "summary_only"
  | "raw_ref_only"
  | "exclude";

export interface ToolContextPayload {
  content: string;
  tokenEstimate: number;
  policy: ToolContextPolicy;
}

export interface ToolOutputArtifact {
  id: string;
  ref: string;
  kind: "raw_output";
  mediaType: string;
  bytes: number;
  tokenEstimate: number;
  createdAt: string;
}

export interface ToolOutputMetrics {
  rawBytes: number;
  contextBytes: number;
  estimatedRawTokens: number;
  estimatedContextTokens: number;
  reductionRatio: number;
  truncated: boolean;
  filterId: string;
  strategy: ToolOutputOptimizationStrategy;
}

export interface ToolOmittedSection {
  reason: string;
  rawRef?: string;
  bytes?: number;
  tokenEstimate?: number;
}

export interface ToolOutputArtifactInput {
  toolName: string;
  threadId: string;
  branchId: string;
  content: string;
  mediaType: string;
}

export interface ToolOutputArtifactStore {
  save(input: ToolOutputArtifactInput): Promise<ToolOutputArtifact>;
  read(ref: string): Promise<string | undefined>;
}

export interface ToolResultPolicyInput {
  result: ToolResult;
  maxContextTokens: number;
}

export interface ToolResultPolicyResult {
  result: ToolResult;
  warnings: string[];
}

export interface ToolResultPolicy {
  apply(input: ToolResultPolicyInput): ToolResultPolicyResult;
}

export interface ToolSuccessResult {
  ok: true;
  summary: string;
  display: string;
  context: ToolContextPayload;
  artifacts: ToolOutputArtifact[];
  metrics: ToolOutputMetrics;
  omitted: ToolOmittedSection[];
  data?: unknown;
}

export interface ToolErrorResult {
  ok: false;
  summary: string;
  display: string;
  context: ToolContextPayload;
  artifacts: ToolOutputArtifact[];
  metrics: ToolOutputMetrics;
  omitted: ToolOmittedSection[];
  error: ToolExecutionError;
}

export interface ToolExecutionError {
  code: string;
  message: string;
  recoverable: boolean;
}

export type ToolResult = ToolSuccessResult | ToolErrorResult;

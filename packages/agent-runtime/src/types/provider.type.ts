import type OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import type { AgentRole, ModelRef } from "./agent.type";
import type { TokenUsage } from "./runtime.type";

export type ProviderKind = "openai" | "anthropic" | "local" | "custom";

export type ProviderRuntimeType = "openai-compatible";

export interface AgentRuntimeConfig {
  defaultRole: AgentRole;
  providers: Record<string, ProviderConfig>;
  models: Record<string, ModelConfig>;
  agents: Partial<Record<AgentRole, RoleModelConfig>>;
}

export interface ProviderConfig {
  kind: ProviderKind;
  apiUrl: string;
  apiUrlEnvName?: string;
  apiKeyEnvName: string;
  apiKeySecretRef?: string;
  compatibility?: OpenAICompatibleProviderCompatibility;
}

export interface OpenAICompatibleProviderCompatibility {
  toolResultMessageRole?: "tool" | "user";
}

export interface ModelConfig {
  providerId: string;
  modelId: string;
  parameters?: ModelParameters;
}

export interface ModelParameters {
  maxCompletionTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string | string[] | null;
}

export interface RoleModelConfig {
  role: AgentRole;
  modelRef: string;
  fallbackModelRefs: string[];
}

export interface ModelProvider {
  id: string;
  createMessage(
    request: ModelRequest,
    signal?: AbortSignal
  ): AsyncIterable<ModelEvent>;
}

export interface ModelRequest {
  model: ModelRef;
  system: string[];
  messages: ModelMessage[];
  tools: ModelToolDefinition[];
  maxOutputTokens?: number;
  parameters?: ModelParameters;
  metadata?: Record<string, string>;
}

export interface ModelMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  reasoningContent?: string;
  toolCallId?: string;
  toolCalls?: ModelToolCall[];
}

export interface ModelToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;
}

export type ModelEvent =
  | ModelTextDeltaEvent
  | ModelToolCallDoneEvent
  | ModelUsageEvent
  | ModelDoneEvent
  | ModelErrorEvent;

export interface ModelTextDeltaEvent {
  type: "text_delta";
  text: string;
}

export interface ModelToolCallDoneEvent {
  type: "tool_call_done";
  toolCall: ModelToolCall;
  reasoningContent?: string;
}

export interface ModelUsageEvent {
  type: "usage";
  usage: TokenUsage;
}

export interface ModelDoneEvent {
  type: "done";
  stopReason: ModelStopReason;
}

export interface ModelErrorEvent {
  type: "error";
  error: ModelProviderError;
}

export interface ModelToolCall {
  id: string;
  name: string;
  input: unknown;
}

export type ModelStopReason =
  | "end_turn"
  | "tool_use"
  | "max_tokens"
  | "provider_error"
  | "user_interrupted";

export interface ModelProviderError {
  code: string;
  message: string;
  retryable: boolean;
  status?: number;
  requestId?: string;
  details?: unknown;
}

export interface ProviderFactoryInput {
  providerId: string;
  providerConfig: ProviderConfig;
  modelConfig: ModelConfig;
}

export interface ProviderResolutionOptions {
  providerType?: ProviderRuntimeType;
  env?: NodeJS.ProcessEnv;
  openAIOptions?: Omit<OpenAICompatibleProviderOptions, "apiKey">;
}

export type ProviderCreationResult =
  | ProviderCreationSuccess
  | ProviderCreationFailure;

export interface ProviderCreationSuccess {
  ok: true;
  provider: ModelProvider;
}

export interface ProviderCreationFailure {
  ok: false;
  error: ProviderCreationError;
}

export interface ProviderCreationError {
  code: ProviderCreationErrorCode;
  message: string;
}

export type ProviderCreationErrorCode =
  | "missing_api_key"
  | "unsupported_provider_kind"
  | "unsupported_provider_type";

export type ProviderResolutionResult =
  | ProviderResolutionSuccess
  | ProviderResolutionFailure;

export interface ProviderResolutionSuccess {
  ok: true;
  provider: ModelProvider;
  role: AgentRole;
  modelRef: string;
  model: ModelRef;
  providerConfig: ProviderConfig;
  modelConfig: ModelConfig;
  issues: ProviderResolutionIssue[];
}

export interface ProviderResolutionFailure {
  ok: false;
  error: ProviderResolutionError;
  issues: ProviderResolutionIssue[];
}

export interface ProviderResolutionError {
  code: ProviderResolutionErrorCode;
  message: string;
}

export type ProviderResolutionErrorCode =
  | "missing_default_role"
  | "missing_model_ref"
  | "missing_provider"
  | "provider_unavailable"
  | ProviderCreationErrorCode;

export interface ProviderResolutionIssue {
  code: ProviderResolutionIssueCode;
  message: string;
}

export type ProviderResolutionIssueCode =
  | "missing_agent_role"
  | "missing_model_ref"
  | "missing_provider"
  | "provider_unavailable"
  | ProviderCreationErrorCode;

export interface OpenAICompatibleProviderOptions {
  client?: OpenAIChatCompletionsClient;
  apiKey?: string;
}

export interface OpenAIChatCompletionsClient {
  chat: {
    completions: {
      create(
        body: ChatCompletionCreateParamsNonStreaming,
        options?: { signal?: AbortSignal }
      ): Promise<ChatCompletion>;
    };
  };
}

export interface OpenAIClientConfig {
  apiUrl: string;
  apiKey?: string;
}

export interface OpenAIClientFactoryInput {
  config: OpenAIClientConfig;
  OpenAIClient?: typeof OpenAI;
}

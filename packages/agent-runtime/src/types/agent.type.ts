import type { SystemPromptRef } from "./prompt.type";

export interface AgentProfile {
  id: string;
  displayName: string;
  role: AgentRole;
  systemPrompt: SystemPromptRef;
  model: ModelRef;
  allowedTools: string[];
  contextPolicy: ContextPolicy;
  stopPolicy: StopPolicy;
  writeAccess: AgentWriteAccess;
}

export type AgentRole = "coder" | "oracle" | "reviewer" | "explorer";

export interface AgentRoleDefinition {
  role: AgentRole;
  displayName: string;
  systemPrompt: SystemPromptRef;
  defaultModel: ModelRef;
  defaultAllowedTools: string[];
  defaultContextPolicy: ContextPolicy;
  defaultStopPolicy: StopPolicy;
  defaultWriteAccess: AgentWriteAccess;
}

export type AgentWriteAccess = "none" | "workspace" | "limited";

export interface ModelRef {
  providerId: string;
  modelId: string;
}

export interface ContextPolicy {
  maxInputTokens: number;
  includeProjectInstructions: boolean;
  includeRecentMessages: boolean;
  includeMemory: boolean;
  includeToolDefinitions: boolean;
}

export interface StopPolicy {
  maxIterations: number;
  stopOnProviderError: boolean;
  stopOnToolError: boolean;
}

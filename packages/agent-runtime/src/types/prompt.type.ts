import type { AgentRole } from "./agent.type";

export type PromptKind = "system" | "context" | "memory" | "tool";

export interface PromptTemplate {
  id: string;
  kind: PromptKind;
  version: string;
  title: string;
  content: string;
  variables: PromptVariable[];
  tokenEstimate?: number;
}

export interface PromptVariable {
  name: string;
  required: boolean;
  description: string;
}

export interface SystemPromptRef {
  promptId: string;
  version?: string;
}

export interface AgentRolePrompt {
  role: AgentRole;
  systemPrompt: PromptTemplate;
}

export interface PromptStore {
  getSystemPrompt(ref: SystemPromptRef): Promise<PromptTemplate | undefined>;
  listAgentRolePrompts(): Promise<AgentRolePrompt[]>;
}

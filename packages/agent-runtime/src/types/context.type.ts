import type { AgentProfile } from "./agent.type";
import type { ModelMessage } from "./provider.type";

export interface ContextBuilder {
  build(input: ContextBuildInput): Promise<ContextBuildResult>;
}

export interface ContextBuildInput {
  profile: AgentProfile;
  threadId: string;
  branchId: string;
  messages: ModelMessage[];
}

export interface ContextBuildResult {
  system: string[];
  messages: ModelMessage[];
  tokenEstimate: number;
}

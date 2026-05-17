import type { AgentProfile } from "./agent.type";
import type { MemoryEntry } from "./memory.type";
import type { ModelMessage } from "./provider.type";
import type { ToolContextPayload } from "./tool-output.type";

export interface ContextBuilder {
  build(input: ContextBuildInput): Promise<ContextBuildResult>;
}

export interface ContextBuildInput {
  profile: AgentProfile;
  threadId: string;
  branchId: string;
  workspacePath?: string;
  messages: ModelMessage[];
  memoryEntries?: MemoryEntry[];
  toolResults?: ContextToolResult[];
}

export interface ContextBuildResult {
  system: string[];
  messages: ModelMessage[];
  sections: ContextSection[];
  skippedSections: SkippedContextSection[];
  tokenEstimate: number;
}

export type ContextSectionKind =
  | "system"
  | "project_instructions"
  | "recent_messages"
  | "memory"
  | "tool_results";

export interface ContextSection {
  kind: ContextSectionKind;
  title: string;
  content: string;
  tokenEstimate: number;
  source: ContextSectionSource;
}

export interface ContextSectionSource {
  type: "agent_profile" | "workspace_file" | "thread" | "memory" | "tool";
  ref: string;
}

export interface SkippedContextSection {
  kind: ContextSectionKind;
  title: string;
  reason: string;
  source?: ContextSectionSource;
  error?: ContextSectionError;
}

export interface ContextSectionError {
  code: string;
  message: string;
}

export interface ContextToolResult {
  toolCallId: string;
  toolName: string;
  context: ToolContextPayload;
}

export interface ProjectInstructionDocument {
  relativePath: string;
  content: string;
}

export interface ProjectInstructionLoadResult {
  documents: ProjectInstructionDocument[];
  skipped: SkippedContextSection[];
}

import type { RunContext } from "./framework-context.type";
import type { ModelToolDefinition } from "./provider.type";
import type {
  ToolOutputArtifactStore,
  ToolResult,
  ToolResultPolicy,
} from "./tool-output.type";

export interface Tool {
  name: string;
  description: string;
  inputSchema: unknown;
  execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult>;
}

export interface ToolExecutionContext {
  run: RunContext;
  artifactStore?: ToolOutputArtifactStore;
  resultPolicy: ToolResultPolicy;
}

export interface ToolRegistry {
  execute(
    name: string,
    input: unknown,
    context: ToolExecutionContext
  ): Promise<ToolResult>;
  listDefinitions(allowedTools: string[]): ModelToolDefinition[];
}

export type { ToolResult } from "./tool-output.type";

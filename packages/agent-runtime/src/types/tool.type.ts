import type { ModelToolDefinition } from "./provider.type";

export interface Tool {
  name: string;
  description: string;
  inputSchema: unknown;
  execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult>;
}

export interface ToolExecutionContext {
  threadId: string;
  branchId: string;
}

export type ToolResult = ToolSuccessResult | ToolErrorResult;

export interface ToolSuccessResult {
  ok: true;
  content: string;
  data?: unknown;
}

export interface ToolErrorResult {
  ok: false;
  error: ToolExecutionError;
}

export interface ToolExecutionError {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface ToolRegistry {
  execute(
    name: string,
    input: unknown,
    context: ToolExecutionContext
  ): Promise<ToolResult>;
  listDefinitions(allowedTools: string[]): ModelToolDefinition[];
}

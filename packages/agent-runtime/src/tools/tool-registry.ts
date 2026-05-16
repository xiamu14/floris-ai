import type { ModelToolDefinition } from "../types/provider.type";
import type {
  Tool,
  ToolExecutionContext,
  ToolRegistry as ToolRegistryContract,
  ToolResult,
} from "../types/tool.type";

export class InMemoryToolRegistry implements ToolRegistryContract {
  private readonly tools: Map<string, Tool>;

  constructor(tools: Tool[] = []) {
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
  }

  execute(
    name: string,
    input: unknown,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      const message = `Tool "${name}" is not registered.`;

      return Promise.resolve({
        ok: false,
        summary: "Unknown tool.",
        display: message,
        context: {
          content: `Tool error: ${message}`,
          tokenEstimate: Math.ceil(message.length / 4),
          policy: "include",
        },
        artifacts: [],
        metrics: {
          rawBytes: new TextEncoder().encode(message).byteLength,
          contextBytes: new TextEncoder().encode(message).byteLength,
          estimatedRawTokens: Math.ceil(message.length / 4),
          estimatedContextTokens: Math.ceil(message.length / 4),
          reductionRatio: 1,
          truncated: false,
          filterId: "registry-error-filter",
          strategy: "structure_only",
        },
        omitted: [],
        error: {
          code: "unknown_tool",
          message,
          recoverable: true,
        },
      });
    }

    return tool.execute(input, context);
  }

  listDefinitions(allowedTools: string[]): ModelToolDefinition[] {
    return allowedTools.flatMap((name) => {
      const tool = this.tools.get(name);

      if (!tool) {
        return [];
      }

      return [
        {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        },
      ];
    });
  }
}

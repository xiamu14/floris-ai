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
      return Promise.resolve({
        ok: false,
        error: {
          code: "unknown_tool",
          message: `Tool "${name}" is not registered.`,
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

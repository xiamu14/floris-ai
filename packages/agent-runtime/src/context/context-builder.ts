import type {
  ContextBuilder,
  ContextBuildInput,
  ContextBuildResult,
} from "../types/context.type";

export class BasicContextBuilder implements ContextBuilder {
  build(input: ContextBuildInput): Promise<ContextBuildResult> {
    const system = [
      `You are ${input.profile.displayName}, a ${input.profile.role} agent in Fate AI.`,
      "Use available tools when they are relevant. After a tool result, provide a concise final answer.",
    ];

    return Promise.resolve({
      system,
      messages: input.messages,
      tokenEstimate: estimateTokens(
        [...system, ...input.messages.map((message) => message.content)].join(
          "\n"
        )
      ),
    });
  }
}

function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

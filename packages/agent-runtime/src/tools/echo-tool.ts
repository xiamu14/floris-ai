import { type as arkType } from "arktype";
import type { Tool } from "../types/tool.type";
import { byteLength, estimateTokens } from "./tool-output-artifact-store";

const EchoToolInput = arkType({
  text: "string",
});

export const echoTool: Tool = {
  name: "echo_tool",
  description: "Echoes the provided text.",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string" },
    },
    required: ["text"],
    additionalProperties: false,
  },
  async execute(input, context) {
    await Promise.resolve();

    const parsed = EchoToolInput(input);

    if (parsed instanceof arkType.errors) {
      const message = String(parsed);
      const tokenEstimate = estimateTokens(message);

      return {
        ok: false,
        summary: "echo_tool input validation failed.",
        display: message,
        context: {
          content: `Tool error: ${message}`,
          tokenEstimate,
          policy: "include",
        },
        artifacts: [],
        metrics: {
          rawBytes: byteLength(message),
          contextBytes: byteLength(message),
          estimatedRawTokens: tokenEstimate,
          estimatedContextTokens: tokenEstimate,
          reductionRatio: 1,
          truncated: false,
          filterId: "echo-domain-filter",
          strategy: "structure_only",
        },
        omitted: [],
        error: {
          code: "invalid_input",
          message,
          recoverable: true,
        },
      };
    }

    const rawOutput = parsed.text;
    const artifact = await context.artifactStore?.save({
      toolName: "echo_tool",
      threadId: context.run.threadId,
      branchId: context.run.branchId,
      content: rawOutput,
      mediaType: "text/plain",
    });
    const rawTokens = estimateTokens(rawOutput);
    const contextContent = rawOutput;
    const contextTokens = estimateTokens(contextContent);
    const artifacts = artifact ? [artifact] : [];

    return {
      ok: true,
      summary: `Echoed ${rawOutput.length} character(s).`,
      display: rawOutput,
      context: {
        content: contextContent,
        tokenEstimate: contextTokens,
        policy: "include",
      },
      artifacts,
      metrics: {
        rawBytes: byteLength(rawOutput),
        contextBytes: byteLength(contextContent),
        estimatedRawTokens: rawTokens,
        estimatedContextTokens: contextTokens,
        reductionRatio: rawTokens / Math.max(contextTokens, 1),
        truncated: false,
        filterId: "echo-domain-filter",
        strategy: "structure_only",
      },
      omitted: [],
      data: parsed,
    };
  },
};

import { type as arkType } from "arktype";
import type { Tool } from "../types/tool.type";

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
  async execute(input) {
    await Promise.resolve();

    const parsed = EchoToolInput(input);

    if (parsed instanceof arkType.errors) {
      return {
        ok: false,
        error: {
          code: "invalid_input",
          message: String(parsed),
          recoverable: true,
        },
      };
    }

    return {
      ok: true,
      content: parsed.text,
      data: parsed,
    };
  },
};

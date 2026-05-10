import { describe, expect, it } from "vitest";
import { echoTool } from "../src/tools/echo-tool";
import { InMemoryToolRegistry } from "../src/tools/tool-registry";

describe("tool registry", () => {
  it("executes registered tools", async () => {
    const registry = new InMemoryToolRegistry([echoTool]);

    await expect(
      registry.execute(
        "echo_tool",
        { text: "hello" },
        { threadId: "thread", branchId: "branch" }
      )
    ).resolves.toEqual({
      ok: true,
      content: "hello",
      data: { text: "hello" },
    });
  });

  it("returns a recoverable error for unknown tools", async () => {
    const registry = new InMemoryToolRegistry([]);

    await expect(
      registry.execute(
        "missing_tool",
        {},
        { threadId: "thread", branchId: "branch" }
      )
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "unknown_tool",
        message: 'Tool "missing_tool" is not registered.',
        recoverable: true,
      },
    });
  });
});

import { describe, expect, it } from "vitest";
import { echoTool } from "../src/tools/echo-tool";
import { InMemoryToolOutputArtifactStore } from "../src/tools/tool-output-artifact-store";
import { InMemoryToolRegistry } from "../src/tools/tool-registry";
import { defaultToolResultPolicy } from "../src/tools/tool-result-policy";

describe("tool registry", () => {
  it("executes registered tools", async () => {
    const registry = new InMemoryToolRegistry([echoTool]);
    const artifactStore = new InMemoryToolOutputArtifactStore();

    const result = await registry.execute(
      "echo_tool",
      { text: "hello" },
      {
        run: {
          threadId: "thread",
          branchId: "branch",
          agentId: "coder",
          workspacePath: process.cwd(),
        },
        artifactStore,
        resultPolicy: defaultToolResultPolicy,
      }
    );

    expect(result).toMatchObject({
      ok: true,
      summary: "Echoed 5 character(s).",
      display: "hello",
      context: {
        content: "hello",
        policy: "include",
      },
      metrics: {
        filterId: "echo-domain-filter",
        strategy: "structure_only",
        truncated: false,
      },
      omitted: [],
      data: { text: "hello" },
    });
    expect(result.artifacts).toHaveLength(1);
    await expect(
      artifactStore.read(result.artifacts[0]?.ref ?? "")
    ).resolves.toBe("hello");
  });

  it("returns a recoverable error for unknown tools", async () => {
    const registry = new InMemoryToolRegistry([]);

    await expect(
      registry.execute(
        "missing_tool",
        {},
        {
          run: {
            threadId: "thread",
            branchId: "branch",
            agentId: "coder",
            workspacePath: process.cwd(),
          },
          resultPolicy: defaultToolResultPolicy,
        }
      )
    ).resolves.toMatchObject({
      ok: false,
      summary: "Unknown tool.",
      context: {
        content: 'Tool error: Tool "missing_tool" is not registered.',
      },
      metrics: {
        filterId: "registry-error-filter",
      },
      error: {
        code: "unknown_tool",
        message: 'Tool "missing_tool" is not registered.',
        recoverable: true,
      },
    });
  });
});

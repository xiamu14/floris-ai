import { describe, expect, it } from "vitest";
import { BasicContextBuilder } from "../src/context/context-builder";
import type { AgentProfile } from "../src/types/agent.type";

describe("context builder", () => {
  it("builds system sections and keeps recent messages", async () => {
    const builder = new BasicContextBuilder();
    const result = await builder.build({
      profile: createProfile(),
      threadId: "thread",
      branchId: "branch",
      messages: [
        {
          role: "user",
          content: "hello",
        },
      ],
    });

    expect(result.system[0]).toContain("Coder");
    expect(result.messages).toEqual([
      {
        role: "user",
        content: "hello",
      },
    ]);
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });
});

function createProfile(): AgentProfile {
  return {
    id: "coder",
    displayName: "Coder",
    role: "coder",
    systemPrompt: {
      promptId: "agent.coder.system",
    },
    model: {
      providerId: "test",
      modelId: "test-coder",
    },
    allowedTools: ["echo_tool"],
    contextPolicy: {
      maxInputTokens: 4000,
      includeProjectInstructions: true,
      includeRecentMessages: true,
      includeMemory: true,
      includeToolDefinitions: true,
    },
    stopPolicy: {
      maxIterations: 4,
      stopOnProviderError: true,
      stopOnToolError: true,
    },
    writeAccess: "workspace",
  };
}

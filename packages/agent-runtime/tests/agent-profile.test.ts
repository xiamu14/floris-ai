import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_ROLE_PROMPTS } from "../src/prompts/default-agent-role-prompts";
import type { AgentProfile } from "../src/types/agent.type";

describe("agent profile", () => {
  it("references a system prompt explicitly", () => {
    const coderPrompt = DEFAULT_AGENT_ROLE_PROMPTS.find(
      (entry) => entry.role === "coder"
    );

    const profile: AgentProfile = {
      id: "coder",
      displayName: "Coder",
      role: "coder",
      systemPrompt: {
        promptId: "agent.coder.system",
        version: "1",
      },
      model: {
        providerId: "mock",
        modelId: "mock-coder",
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

    expect(profile.systemPrompt.promptId).toBe(coderPrompt?.systemPrompt.id);
  });
});

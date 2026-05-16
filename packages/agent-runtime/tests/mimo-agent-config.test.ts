import { describe, expect, it } from "vitest";
import { createMimoAgentConfig } from "../src/config/mimo-agent-config";

describe("MIMO agent config option", () => {
  it("configures MIMO as an OpenAI-compatible provider for every role", () => {
    const config = createMimoAgentConfig({
      MIMO_API_KEY: "test-key",
      MIMO_BASE_URL: "https://api.xiaomimimo.com/v1",
    });

    expect(config.providers.mimo).toEqual({
      kind: "openai",
      apiUrl: "https://api.xiaomimimo.com/v1",
      apiUrlEnvName: "MIMO_BASE_URL",
      apiKeyEnvName: "MIMO_API_KEY",
      compatibility: {
        toolResultMessageRole: "user",
      },
    });
    expect(config.models["mimo-v2.5-pro"]).toEqual({
      providerId: "mimo",
      modelId: "mimo-v2.5-pro",
      parameters: {
        maxCompletionTokens: 4096,
        temperature: 1,
        topP: 0.95,
        frequencyPenalty: 0,
        presencePenalty: 0,
        stop: null,
      },
    });
    expect(Object.keys(config.agents).sort()).toEqual([
      "coder",
      "explorer",
      "oracle",
      "reviewer",
    ]);
  });
});

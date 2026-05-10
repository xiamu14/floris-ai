import { describe, expect, it } from "vitest";
import { createOpenAICompatibleProviderFromEnv } from "../src/providers/openai-compatible-provider-factory";

describe("OpenAI-compatible provider factory", () => {
  it("returns undefined when required api key env is missing", () => {
    const provider = createOpenAICompatibleProviderFromEnv(
      {
        providerId: "compatible",
        providerConfig: {
          kind: "openai",
          apiUrl: "https://api.compatible.example/v1",
          apiKeyEnv: "COMPATIBLE_API_KEY",
        },
        modelConfig: {
          providerId: "compatible",
          modelId: "provider-model",
        },
      },
      {}
    );

    expect(provider).toBeUndefined();
  });

  it("creates a provider when required api key env is present", () => {
    const provider = createOpenAICompatibleProviderFromEnv(
      {
        providerId: "compatible",
        providerConfig: {
          kind: "openai",
          apiUrl: "https://api.compatible.example/v1",
          apiKeyEnv: "COMPATIBLE_API_KEY",
        },
        modelConfig: {
          providerId: "compatible",
          modelId: "provider-model",
        },
      },
      {
        COMPATIBLE_API_KEY: "test-key",
      }
    );

    expect(provider?.id).toBe("compatible");
  });
});

import { describe, expect, it } from "vitest";
import { createOpenAICompatibleProviderFromEnv } from "../src/providers/openai-compatible-provider-factory";

describe("OpenAI-compatible provider factory", () => {
  it("returns a precise error when required api key env is missing", () => {
    const result = createOpenAICompatibleProviderFromEnv(
      {
        providerId: "compatible",
        providerConfig: {
          kind: "openai",
          apiUrl: "https://api.compatible.example/v1",
          apiKeyEnvName: "COMPATIBLE_API_KEY",
        },
        modelConfig: {
          providerId: "compatible",
          modelId: "provider-model",
        },
      },
      {}
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "missing_api_key",
        message: 'Environment variable "COMPATIBLE_API_KEY" is not set.',
      },
    });
  });

  it("creates a provider when required api key env is present", () => {
    const result = createOpenAICompatibleProviderFromEnv(
      {
        providerId: "compatible",
        providerConfig: {
          kind: "openai",
          apiUrl: "https://api.compatible.example/v1",
          apiKeyEnvName: "COMPATIBLE_API_KEY",
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

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.provider.id).toBe("compatible");
    }
  });
});

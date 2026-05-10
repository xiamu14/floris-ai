import { describe, expect, it } from "vitest";
import { resolveProviderForRole } from "../src/providers/provider-resolver";
import type {
  AgentRuntimeConfig,
  ModelProvider,
  ProviderFactoryInput,
} from "../src/types/provider.type";

const config: AgentRuntimeConfig = {
  defaultRole: "coder",
  providers: {
    openai: {
      kind: "openai",
      apiUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
    },
    anthropic: {
      kind: "anthropic",
      apiUrl: "https://api.anthropic.com",
      apiKeyEnv: "ANTHROPIC_API_KEY",
    },
  },
  models: {
    fast: {
      providerId: "openai",
      modelId: "gpt-4.1-mini",
    },
    strong: {
      providerId: "anthropic",
      modelId: "claude-sonnet-4-5",
    },
  },
  agents: {
    coder: {
      role: "coder",
      modelRef: "fast",
      fallbackModelRefs: ["strong"],
    },
    oracle: {
      role: "oracle",
      modelRef: "strong",
      fallbackModelRefs: ["fast"],
    },
  },
};

describe("provider resolver", () => {
  it("resolves a role to a configured provider and model", () => {
    const result = resolveProviderForRole(config, "coder", createProvider);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.provider.id).toBe("openai");
      expect(result.model).toEqual({
        providerId: "openai",
        modelId: "gpt-4.1-mini",
      });
      expect(result.providerConfig.apiUrl).toBe("https://api.openai.com/v1");
    }
  });

  it("falls back to the default role when the requested role is missing", () => {
    const result = resolveProviderForRole(
      {
        ...config,
        agents: {
          coder: {
            role: "coder",
            modelRef: "fast",
            fallbackModelRefs: ["strong"],
          },
        },
      },
      "reviewer",
      createProvider
    );

    expect(result.ok).toBe(true);
    expect(result.issues[0]?.code).toBe("missing_agent_role");

    if (result.ok) {
      expect(result.role).toBe("coder");
      expect(result.model.modelId).toBe("gpt-4.1-mini");
    }
  });

  it("tries fallback model refs when the primary provider is unavailable", () => {
    const result = resolveProviderForRole(config, "coder", (input) => {
      if (input.providerId === "openai") {
        return undefined;
      }

      return createProvider(input);
    });

    expect(result.ok).toBe(true);
    expect(result.issues[0]?.code).toBe("provider_unavailable");

    if (result.ok) {
      expect(result.provider.id).toBe("anthropic");
      expect(result.model.modelId).toBe("claude-sonnet-4-5");
    }
  });
});

function createProvider(input: ProviderFactoryInput): ModelProvider {
  return {
    id: input.providerId,
    async *createMessage() {
      await Promise.resolve();

      yield {
        type: "done",
        stopReason: "end_turn",
      };
    },
  };
}

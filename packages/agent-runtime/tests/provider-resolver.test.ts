import { describe, expect, it } from "vitest";
import { resolveProviderForRole } from "../src/providers/provider-resolver";
import type { AgentRuntimeConfig } from "../src/types/provider.type";

const config: AgentRuntimeConfig = {
  defaultRole: "coder",
  providers: {
    openai: {
      kind: "openai",
      apiUrl: "https://api.openai.com/v1",
      apiKeyEnvName: "OPENAI_API_KEY",
    },
    backup: {
      kind: "openai",
      apiUrl: "https://api.backup.example/v1",
      apiKeyEnvName: "BACKUP_API_KEY",
    },
  },
  models: {
    fast: {
      providerId: "openai",
      modelId: "gpt-4.1-mini",
    },
    strong: {
      providerId: "backup",
      modelId: "backup-strong",
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
    const result = resolveProviderForRole(config, "coder", {
      providerType: "openai-compatible",
      env: {
        OPENAI_API_KEY: "test-key",
        BACKUP_API_KEY: "backup-key",
      },
    });

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
      {
        providerType: "openai-compatible",
        env: {
          OPENAI_API_KEY: "test-key",
          BACKUP_API_KEY: "backup-key",
        },
      }
    );

    expect(result.ok).toBe(true);
    expect(result.issues[0]?.code).toBe("missing_agent_role");

    if (result.ok) {
      expect(result.role).toBe("coder");
      expect(result.model.modelId).toBe("gpt-4.1-mini");
    }
  });

  it("tries fallback model refs when the primary provider is unavailable", () => {
    const result = resolveProviderForRole(config, "coder", {
      providerType: "openai-compatible",
      env: {
        BACKUP_API_KEY: "backup-key",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.issues[0]?.code).toBe("missing_api_key");
    expect(result.issues[0]?.message).toBe(
      'Environment variable "OPENAI_API_KEY" is not set.'
    );

    if (result.ok) {
      expect(result.provider.id).toBe("backup");
      expect(result.model.modelId).toBe("backup-strong");
    }
  });

  it("returns a precise error when no provider can be created", () => {
    const result = resolveProviderForRole(config, "oracle", {
      providerType: "openai-compatible",
      env: {},
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toEqual({
        code: "missing_api_key",
        message: 'Environment variable "OPENAI_API_KEY" is not set.',
      });
    }
  });
});

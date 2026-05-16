import { defineAgentConfig } from "../providers/model-provider";

const MIMO_PLATFORM_BASE_URL = "https://api.xiaomimimo.com/v1";

export function createMimoAgentConfig(env: NodeJS.ProcessEnv = process.env) {
  return defineAgentConfig({
    defaultRole: "coder",
    providers: {
      mimo: {
        kind: "openai",
        apiUrl: env.MIMO_BASE_URL ?? MIMO_PLATFORM_BASE_URL,
        apiUrlEnvName: "MIMO_BASE_URL",
        apiKeyEnvName: "MIMO_API_KEY",
        compatibility: {
          toolResultMessageRole: "user",
        },
      },
    },
    models: {
      "mimo-v2.5-pro": {
        providerId: "mimo",
        modelId: "mimo-v2.5-pro",
        parameters: {
          maxCompletionTokens: 1024,
          temperature: 1,
          topP: 0.95,
          frequencyPenalty: 0,
          presencePenalty: 0,
          stop: null,
        },
      },
    },
    agents: {
      coder: {
        role: "coder",
        modelRef: "mimo-v2.5-pro",
        fallbackModelRefs: [],
      },
      oracle: {
        role: "oracle",
        modelRef: "mimo-v2.5-pro",
        fallbackModelRefs: [],
      },
      reviewer: {
        role: "reviewer",
        modelRef: "mimo-v2.5-pro",
        fallbackModelRefs: [],
      },
      explorer: {
        role: "explorer",
        modelRef: "mimo-v2.5-pro",
        fallbackModelRefs: [],
      },
    },
  });
}

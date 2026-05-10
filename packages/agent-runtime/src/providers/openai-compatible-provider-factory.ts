import type {
  OpenAICompatibleProviderOptions,
  ProviderCreationResult,
  ProviderFactoryInput,
} from "../types/provider.type";
import { OpenAICompatibleModelProvider } from "./openai-compatible-provider";
import { readRequiredApiKeyFromEnv } from "./utils/openai-client";

export function createOpenAICompatibleProviderFromEnv(
  input: ProviderFactoryInput,
  env: NodeJS.ProcessEnv = process.env,
  options: Omit<OpenAICompatibleProviderOptions, "apiKey"> = {}
): ProviderCreationResult {
  if (input.providerConfig.kind !== "openai") {
    return {
      ok: false,
      error: {
        code: "unsupported_provider_kind",
        message: `Provider "${input.providerId}" uses kind "${input.providerConfig.kind}", not "openai".`,
      },
    };
  }

  const apiKey = readRequiredApiKeyFromEnv(
    env,
    input.providerConfig.apiKeyEnvName
  );

  if (apiKey instanceof Error) {
    return {
      ok: false,
      error: {
        code: "missing_api_key",
        message: apiKey.message,
      },
    };
  }

  return {
    ok: true,
    provider: new OpenAICompatibleModelProvider(input, {
      ...options,
      apiKey,
    }),
  };
}
